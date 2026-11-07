import os
import secrets
import hashlib
import requests
import logging
from contextlib import contextmanager
from typing import Optional, Literal

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GatePass API", version="3.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_database_url():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


@contextmanager
def db_connection():
    with psycopg.connect(get_database_url(), row_factory=dict_row) as connection:
        yield connection


def hash_qr_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def init_database():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS flats (
                    id SERIAL PRIMARY KEY,
                    flat_number TEXT UNIQUE NOT NULL,
                    building TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    qr_token_hash TEXT UNIQUE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS residents (
                    id SERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    phone TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS visitors (
                    id SERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    phone TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    exited_at TIMESTAMP,
                    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
                    vehicle_number TEXT,
                    approval_token TEXT UNIQUE
                )
            """)

            # Backwards compatibility migration
            cursor.execute("""
                ALTER TABLE visitors
                ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
                ADD COLUMN IF NOT EXISTS approval_token TEXT UNIQUE
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS secondary_people (
                    id SERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    category TEXT NOT NULL,
                    resident_id INTEGER REFERENCES residents(id),
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    qr_token_hash TEXT UNIQUE NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS resident_movements (
                    id SERIAL PRIMARY KEY,
                    resident_id INTEGER NOT NULL REFERENCES residents(id),
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    action TEXT NOT NULL CHECK (action IN ('Check In', 'Check Out')),
                    vehicle_number TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                ALTER TABLE resident_movements
                ADD COLUMN IF NOT EXISTS vehicle_number TEXT
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS secondary_person_movements (
                    id SERIAL PRIMARY KEY,
                    person_id INTEGER NOT NULL REFERENCES secondary_people(id),
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    action TEXT NOT NULL CHECK (action IN ('Check In', 'Check Out')),
                    vehicle_number TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_resident_movements_resident
                ON resident_movements(resident_id, created_at DESC, id DESC)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_provider_movements_person
                ON secondary_person_movements(person_id, created_at DESC, id DESC)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_visitors_approval_token
                ON visitors(approval_token)
            """)

        connection.commit()


@app.on_event("startup")
def startup():
    init_database()


# -------------------- MODELS --------------------

class FlatCreate(BaseModel):
    flat_number: str = Field(min_length=1, max_length=30)
    building: Optional[str] = Field(default=None, max_length=60)


class ResidentCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    flat_id: int
    phone: str = Field(pattern=r"^[0-9]{10}$")


class VisitorCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    flat_id: int
    phone: str = Field(pattern=r"^[0-9]{10}$")
    purpose: str = Field(min_length=1, max_length=100)
    vehicle_number: Optional[str] = None


class ApprovalResponse(BaseModel):
    token: str
    action: Literal["Approved", "Denied"]


class SecondaryPersonCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    category: str = Field(min_length=1, max_length=80)
    resident_id: Optional[int] = None
    flat_id: int


class QRValidateRequest(BaseModel):
    token: str = Field(min_length=1)


class MovementCreate(BaseModel):
    action: Literal["Check In", "Check Out"]
    vehicle_number: Optional[str] = None


class ResidentMovementCreate(MovementCreate):
    resident_id: int


class ProviderMovementCreate(MovementCreate):
    person_id: int


# -------------------- HEALTH --------------------

@app.get("/")
def root():
    return {"message": "GatePass API is running", "version": "3.1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/db")
def database_health():
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        return {"database": "connected"}
    except Exception:
        logger.exception("Database health check failed")
        raise HTTPException(status_code=500, detail="Database connection failed")


# -------------------- FLATS --------------------

@app.get("/flats")
def get_flats():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, flat_number, building, created_at
                FROM flats
                ORDER BY building, flat_number
            """)
            return cursor.fetchall()


@app.post("/flats")
def create_flat(data: FlatCreate):
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO flats (flat_number, building)
                    VALUES (%s, %s)
                    RETURNING id, flat_number, building, created_at
                """, (data.flat_number.strip(), data.building))
                result = cursor.fetchone()

            connection.commit()
            return result

    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Flat already exists")
    except Exception:
        logger.exception("Could not create flat")
        raise HTTPException(status_code=500, detail="Could not create flat")


@app.delete("/flats/{flat_id}", status_code=204)
def delete_flat(flat_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM flats WHERE id=%s FOR UPDATE", (flat_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            cursor.execute("""
                DELETE FROM secondary_person_movements
                WHERE person_id IN (SELECT id FROM secondary_people WHERE flat_id=%s)
            """, (flat_id,))

            cursor.execute("DELETE FROM resident_movements WHERE flat_id=%s", (flat_id,))
            cursor.execute("DELETE FROM secondary_people WHERE flat_id=%s", (flat_id,))
            cursor.execute("DELETE FROM visitors WHERE flat_id=%s", (flat_id,))
            cursor.execute("DELETE FROM residents WHERE flat_id=%s", (flat_id,))
            cursor.execute("DELETE FROM flats WHERE id=%s", (flat_id,))

        connection.commit()

    return Response(status_code=204)


@app.post("/flats/{flat_id}/qr")
def generate_flat_qr(flat_id: int):
    token = secrets.token_urlsafe(32)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE flats
                SET qr_token_hash=%s
                WHERE id=%s
                RETURNING id, flat_number, building
            """, (hash_qr_token(token), flat_id))

            flat = cursor.fetchone()
            if not flat:
                raise HTTPException(status_code=404, detail="Flat not found")

        connection.commit()

    return {
        "valid": True,
        "type": "flat",
        "flat": flat,
        "qr_token": token,
    }


# -------------------- RESIDENTS --------------------

@app.get("/residents")
def get_residents():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT r.id, r.full_name, r.flat_id, r.phone, r.created_at,
                       f.flat_number, f.building, r.is_active
                FROM residents r
                JOIN flats f ON f.id=r.flat_id
                ORDER BY r.is_active DESC, r.full_name
            """)
            return cursor.fetchall()


@app.post("/residents")
def create_resident(data: ResidentCreate):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM flats WHERE id=%s", (data.flat_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            cursor.execute("""
                INSERT INTO residents (full_name, flat_id, phone)
                VALUES (%s, %s, %s)
                RETURNING id, full_name, flat_id, phone, created_at, is_active
            """, (data.full_name.strip(), data.flat_id, data.phone))

            resident = cursor.fetchone()

        connection.commit()

    return resident


@app.delete("/residents/{resident_id}", status_code=204)
def delete_resident(resident_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM residents WHERE id=%s FOR UPDATE", (resident_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Resident not found")

            cursor.execute("""
                DELETE FROM secondary_person_movements
                WHERE person_id IN (SELECT id FROM secondary_people WHERE resident_id=%s)
            """, (resident_id,))

            cursor.execute("DELETE FROM secondary_people WHERE resident_id=%s", (resident_id,))
            cursor.execute("DELETE FROM resident_movements WHERE resident_id=%s", (resident_id,))
            cursor.execute("DELETE FROM residents WHERE id=%s", (resident_id,))

        connection.commit()

    return Response(status_code=204)


# -------------------- VISITORS & RESIDENT APPROVAL --------------------

@app.get("/visitors")
def get_visitors():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT v.id, v.full_name, v.flat_id, f.flat_number, f.building,
                       v.phone, v.purpose, v.status, v.created_at, v.exited_at,
                       v.is_archived, v.vehicle_number, v.approval_token
                FROM visitors v
                JOIN flats f ON f.id=v.flat_id
                ORDER BY v.created_at DESC
            """)
            return cursor.fetchall()


@app.post("/visitors")
def create_visitor(data: VisitorCreate):
    approval_token = secrets.token_urlsafe(24)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            # 1. Fetch flat details
            cursor.execute("SELECT id, flat_number, building FROM flats WHERE id=%s", (data.flat_id,))
            flat = cursor.fetchone()
            if not flat:
                raise HTTPException(status_code=404, detail="Flat not found")

            # 2. Insert visitor with 'Pending' status and token
            cursor.execute("""
                INSERT INTO visitors
                    (full_name, flat_id, phone, purpose, status, vehicle_number, approval_token)
                VALUES (%s, %s, %s, %s, 'Pending', %s, %s)
                RETURNING *
            """, (
                data.full_name.strip(),
                data.flat_id,
                data.phone,
                data.purpose,
                (data.vehicle_number or "").strip() or None,
                approval_token,
            ))
            visitor = cursor.fetchone()

            # 3. Fetch active residents for this flat
            cursor.execute("""
                SELECT full_name, phone FROM residents
                WHERE flat_id=%s AND is_active=TRUE
            """, (data.flat_id,))
            residents = cursor.fetchall()

        connection.commit()

    # 4. Dispatch SMS with Approval Link to Flat Residents
    fast2sms_key = os.getenv("FAST2SMS_API_KEY")
    app_base_url = os.getenv("APP_BASE_URL", "https://gatepass-3ym0.onrender.com")
    approval_url = f"{app_base_url}/approval?token={approval_token}"

    if fast2sms_key and residents:
        message_text = (
            f"GatePass: {data.full_name.strip()} ({data.purpose}) is at gate for Flat {flat['flat_number']}. "
            f"Allow or Deny entry: {approval_url}"
        )
     for resident in residents:
            if resident["phone"]:
                # Strip +91, spaces, and extract only the last 10 exact digits
                clean_phone = "".join(c for c in resident["phone"] if c.isdigit())[-10:]

                try:
                    requests.post(
                        "https://www.fast2sms.com/dev/bulkV2",
                        headers={"authorization": fast2sms_key},
                        data={
                            "route": "q",
                            "message": message_text,
                            "language": "english",
                            "numbers": clean_phone
                        },
                        timeout=5
                    )
                    )
                    logger.info(f"SMS alert sent to {resident['phone']}")
                except Exception as e:
                    logger.error(f"Failed to dispatch SMS to {resident['phone']}: {e}")

    return visitor


@app.get("/api/approval/details")
def get_approval_details(token: str = Query(...)):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT v.id, v.full_name, v.purpose, v.vehicle_number, v.status,
                       v.created_at, f.flat_number, f.building
                FROM visitors v
                JOIN flats f ON f.id=v.flat_id
                WHERE v.approval_token=%s
            """, (token,))
            details = cursor.fetchone()

    if not details:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    return details


@app.post("/api/approval/respond")
def respond_to_approval(data: ApprovalResponse):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, status FROM visitors WHERE approval_token=%s FOR UPDATE
            """, (data.token,))
            visitor = cursor.fetchone()

            if not visitor:
                raise HTTPException(status_code=404, detail="Visitor entry not found")

            if visitor["status"] != "Pending":
                return {"success": False, "message": f"Visitor already {visitor['status']}"}

            # If resident approves, status becomes 'Inside' (or 'Approved')
            new_status = "Inside" if data.action == "Approved" else "Denied"

            cursor.execute("""
                UPDATE visitors
                SET status=%s
                WHERE approval_token=%s
                RETURNING id, full_name, status
            """, (new_status, data.token))
            updated = cursor.fetchone()

        connection.commit()

    return {"success": True, "status": updated["status"], "message": f"Entry has been {data.action}."}


@app.patch("/visitors/{visitor_id}/checkout")
def checkout_visitor(visitor_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE visitors
                SET status='Exited', exited_at=CURRENT_TIMESTAMP
                WHERE id=%s AND status IN ('Inside', 'Pending') AND is_archived=FALSE
                RETURNING *
            """, (visitor_id,))
            visitor = cursor.fetchone()

        connection.commit()

    if not visitor:
        raise HTTPException(
            status_code=404,
            detail="Visitor not found or already checked out",
        )

    return visitor


@app.delete("/visitors/{visitor_id}", status_code=204)
def delete_visitor(visitor_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM visitors WHERE id=%s RETURNING id", (visitor_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Visitor not found")

        connection.commit()

    return Response(status_code=204)


# -------------------- MOBILE APPROVAL PAGE --------------------

@app.get("/approval", response_class=HTMLResponse)
def serve_approval_page():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>GatePass - Visitor Permission</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; -webkit-overflow-scrolling: touch; }
        .card { background: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); width: 100%; max-width: 400px; padding: 28px 20px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 12px; }
        h2 { font-size: 22px; color: #0f172a; margin-bottom: 6px; }
        p.subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 24px; font-size: 14px; color: #334155; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { font-weight: 500; color: #64748b; }
        .info-val { font-weight: 600; color: #0f172a; }
        .actions { display: flex; gap: 12px; }
        .btn { flex: 1; padding: 16px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform 0.1s; }
        .btn:active { transform: scale(0.97); }
        .btn-allow { background: #16a34a; color: #ffffff; }
        .btn-deny { background: #dc2626; color: #ffffff; }
        .status-msg { margin-top: 20px; font-size: 16px; font-weight: 700; display: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🚪</div>
        <h2>Gate Visitor Alert</h2>
        <p class="subtitle">A visitor is requesting entry to your flat</p>
        
        <div class="info-box" id="infoBox">
          <div class="info-row"><span class="info-label">Visitor:</span><span class="info-val" id="visName">Loading...</span></div>
          <div class="info-row"><span class="info-label">Purpose:</span><span class="info-val" id="visPurpose">Loading...</span></div>
          <div class="info-row"><span class="info-label">Flat:</span><span class="info-val" id="visFlat">Loading...</span></div>
        </div>

        <div class="actions" id="actionButtons">
          <button class="btn btn-allow" onclick="submitDecision('Approved')">Allow (Yes)</button>
          <button class="btn btn-deny" onclick="submitDecision('Denied')">Deny (No)</button>
        </div>

        <div id="statusMsg" class="status-msg"></div>
      </div>

      <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        async function loadVisitor() {
          if (!token) {
            document.body.innerHTML = '<p style="text-align:center;padding:20px;">Invalid or missing link token.</p>';
            return;
          }
          try {
            const res = await fetch(`/api/approval/details?token=${encodeURIComponent(token)}`);
            if (!res.ok) throw new Error("Visitor record not found");
            const data = await res.json();
            
            document.getElementById('visName').innerText = data.full_name;
            document.getElementById('visPurpose').innerText = data.purpose;
            document.getElementById('visFlat').innerText = `${data.building ? data.building + ' - ' : ''}${data.flat_number}`;

            if (data.status !== 'Pending') {
              showFinalStatus(data.status);
            }
          } catch (e) {
            document.getElementById('infoBox').innerHTML = '<p style="color:#dc2626;">This gate entry is invalid or expired.</p>';
            document.getElementById('actionButtons').style.display = 'none';
          }
        }

        async function submitDecision(action) {
          document.getElementById('actionButtons').style.display = 'none';
          const msg = document.getElementById('statusMsg');
          msg.style.display = 'block';
          msg.innerText = "Submitting...";

          try {
            const res = await fetch('/api/approval/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token, action: action })
            });
            const data = await res.json();
            showFinalStatus(data.status || action);
          } catch (e) {
            msg.innerText = "Connection error. Please try again.";
            msg.style.color = "#dc2626";
            document.getElementById('actionButtons').style.display = 'flex';
          }
        }

        function showFinalStatus(status) {
          document.getElementById('actionButtons').style.display = 'none';
          const msg = document.getElementById('statusMsg');
          msg.style.display = 'block';
          if (status === 'Inside' || status === 'Approved') {
            msg.innerText = "✅ Entry ALLOWED. Guard has been notified.";
            msg.style.color = "#16a34a";
          } else {
            msg.innerText = "❌ Entry DENIED.";
            msg.style.color = "#dc2626";
          }
        }

        loadVisitor();
      </script>
    </body>
    </html>
    """


# -------------------- SERVICE PROVIDERS --------------------

@app.get("/secondary-people")
def get_secondary_people():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT s.id, s.full_name, s.phone, s.category, s.resident_id,
                       s.flat_id, s.active, s.created_at,
                       r.full_name AS primary_resident,
                       f.flat_number, f.building
                FROM secondary_people s
                LEFT JOIN residents r ON r.id=s.resident_id
                JOIN flats f ON f.id=s.flat_id
                ORDER BY s.created_at DESC
            """)
            return cursor.fetchall()


@app.post("/secondary-people")
def create_secondary_person(data: SecondaryPersonCreate):
    token = secrets.token_urlsafe(32)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM flats WHERE id=%s", (data.flat_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            if data.resident_id is not None:
                cursor.execute("""
                    SELECT id FROM residents
                    WHERE id=%s AND flat_id=%s AND is_active=TRUE
                """, (data.resident_id, data.flat_id))

                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Active resident not found in this flat")

            cursor.execute("""
                INSERT INTO secondary_people
                    (full_name, phone, category, resident_id, flat_id, qr_token_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, full_name, phone, category, resident_id,
                          flat_id, active, created_at
            """, (
                data.full_name.strip(),
                data.phone,
                data.category,
                data.resident_id,
                data.flat_id,
                hash_qr_token(token),
            ))

            person = cursor.fetchone()

        connection.commit()

    return {**person, "qr_token": token}


@app.post("/secondary-people/{person_id}/qr")
def generate_secondary_person_qr(person_id: int):
    token = secrets.token_urlsafe(32)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, full_name, phone, category, resident_id,
                       flat_id, active, created_at
                FROM secondary_people
                WHERE id=%s AND active=TRUE
                FOR UPDATE
            """, (person_id,))

            person = cursor.fetchone()
            if not person:
                raise HTTPException(status_code=404, detail="Active service provider not found")

            cursor.execute("""
                UPDATE secondary_people
                SET qr_token_hash=%s
                WHERE id=%s
            """, (hash_qr_token(token), person_id))

        connection.commit()

    return {
        "valid": True,
        "type": "secondary",
        "person": person,
        "qr_token": token,
    }


@app.delete("/secondary-people/{person_id}", status_code=204)
def delete_secondary_person(person_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM secondary_people WHERE id=%s FOR UPDATE", (person_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Service provider not found")

            cursor.execute("DELETE FROM secondary_person_movements WHERE person_id=%s", (person_id,))
            cursor.execute("DELETE FROM secondary_people WHERE id=%s", (person_id,))

        connection.commit()

    return Response(status_code=204)


# -------------------- QR VALIDATION --------------------

@app.post("/qr/validate")
def validate_qr(data: QRValidateRequest):
    token_hash = hash_qr_token(data.token)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, flat_number, building
                FROM flats
                WHERE qr_token_hash=%s
            """, (token_hash,))
            flat = cursor.fetchone()

            if flat:
                cursor.execute("""
                    SELECT id, full_name, phone, flat_id
                    FROM residents
                    WHERE flat_id=%s AND is_active=TRUE
                    ORDER BY full_name
                """, (flat["id"],))

                return {
                    "valid": True,
                    "type": "flat",
                    "flat": flat,
                    "residents": cursor.fetchall(),
                }

            cursor.execute("""
                SELECT s.id, s.full_name, s.phone, s.category, s.resident_id,
                       s.flat_id, s.active, r.full_name AS primary_resident,
                       f.flat_number, f.building
                FROM secondary_people s
                LEFT JOIN residents r ON r.id=s.resident_id
                JOIN flats f ON f.id=s.flat_id
                WHERE s.qr_token_hash=%s
            """, (token_hash,))
            person = cursor.fetchone()

    if not person or not person["active"]:
        raise HTTPException(status_code=404, detail="Invalid or inactive QR code")

    return {"valid": True, "type": "secondary", "person": person}


# -------------------- SHARED MOVEMENT HELPERS --------------------

def latest_action(cursor, table: str, id_column: str, entity_id: int):
    cursor.execute(
        f"""SELECT action FROM {table}
            WHERE {id_column}=%s
            ORDER BY created_at DESC, id DESC LIMIT 1""",
        (entity_id,),
    )
    row = cursor.fetchone()
    return row["action"] if row else None


def validate_movement(current_action, requested_action, entity_name):
    inside = current_action == "Check In"
    if requested_action == "Check In" and inside:
        raise HTTPException(status_code=409, detail=f"{entity_name} is already checked in")
    if requested_action == "Check Out" and not inside:
        raise HTTPException(status_code=409, detail=f"{entity_name} is not currently checked in")


# -------------------- RESIDENT MOVEMENTS --------------------

@app.get("/resident-movements")
def get_resident_movements():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT m.id, m.resident_id, m.flat_id, m.action, m.created_at,
                       m.vehicle_number, r.full_name, r.phone,
                       f.flat_number, f.building
                FROM resident_movements m
                JOIN residents r ON r.id=m.resident_id
                JOIN flats f ON f.id=m.flat_id
                ORDER BY m.created_at DESC, m.id DESC
            """)
            return cursor.fetchall()


@app.get("/resident-movements/current")
def get_current_resident_status():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT r.id AS resident_id, r.full_name, r.flat_id,
                       f.flat_number, f.building, m.action, m.created_at,
                       m.vehicle_number
                FROM residents r
                JOIN flats f ON f.id=r.flat_id
                LEFT JOIN LATERAL (
                    SELECT action, created_at, vehicle_number
                    FROM resident_movements
                    WHERE resident_id=r.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                ) m ON TRUE
                WHERE r.is_active=TRUE
                ORDER BY r.full_name
            """)
            rows = cursor.fetchall()

    return [
        {
            **row,
            "status": (
                "Inside" if row["action"] == "Check In"
                else "Outside" if row["action"] == "Check Out"
                else "Unknown"
            ),
        }
        for row in rows
    ]


@app.post("/resident-movements")
def record_resident_movement(data: ResidentMovementCreate):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, flat_id, full_name
                FROM residents
                WHERE id=%s AND is_active=TRUE
                FOR UPDATE
            """, (data.resident_id,))
            resident = cursor.fetchone()

            if not resident:
                raise HTTPException(status_code=404, detail="Active resident not found")

            current = latest_action(cursor, "resident_movements", "resident_id", data.resident_id)
            validate_movement(current, data.action, "Resident")

            cursor.execute("""
                INSERT INTO resident_movements
                    (resident_id, flat_id, action, vehicle_number)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (
                data.resident_id,
                resident["flat_id"],
                data.action,
                (data.vehicle_number or "").strip() or None,
            ))
            movement = cursor.fetchone()

        connection.commit()

    return {
        **movement,
        "full_name": resident["full_name"],
        "status": "Inside" if data.action == "Check In" else "Outside",
    }


# -------------------- PROVIDER MOVEMENTS --------------------

@app.get("/secondary-person-movements")
def get_provider_movements():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT m.id, m.person_id, m.flat_id, m.action, m.created_at,
                       m.vehicle_number, s.full_name, s.phone, s.category,
                       f.flat_number, f.building
                FROM secondary_person_movements m
                JOIN secondary_people s ON s.id=m.person_id
                JOIN flats f ON f.id=m.flat_id
                ORDER BY m.created_at DESC, m.id DESC
            """)
            return cursor.fetchall()


@app.get("/secondary-person-movements/current")
def get_current_provider_status():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT s.id AS person_id, s.full_name, s.flat_id, s.category,
                       f.flat_number, f.building, m.action, m.created_at,
                       m.vehicle_number
                FROM secondary_people s
                JOIN flats f ON f.id=s.flat_id
                LEFT JOIN LATERAL (
                    SELECT action, created_at, vehicle_number
                    FROM secondary_person_movements
                    WHERE person_id=s.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                ) m ON TRUE
                WHERE s.active=TRUE
                ORDER BY s.full_name
            """)
            rows = cursor.fetchall()

    return [
        {
            **row,
            "status": (
                "Inside" if row["action"] == "Check In"
                else "Outside" if row["action"] == "Check Out"
                else "Unknown"
            ),
        }
        for row in rows
    ]


@app.post("/secondary-person-movements")
def record_provider_movement(data: ProviderMovementCreate):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, flat_id, full_name
                FROM secondary_people
                WHERE id=%s AND active=TRUE
                FOR UPDATE
            """, (data.person_id,))
            person = cursor.fetchone()

            if not person:
                raise HTTPException(status_code=404, detail="Active service provider not found")

            current = latest_action(cursor, "secondary_person_movements", "person_id", data.person_id)
            validate_movement(current, data.action, "Service provider")

            cursor.execute("""
                INSERT INTO secondary_person_movements
                    (person_id, flat_id, action, vehicle_number)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """, (
                data.person_id,
                person["flat_id"],
                data.action,
                (data.vehicle_number or "").strip() or None,
            ))
            movement = cursor.fetchone()

        connection.commit()

    return {
        **movement,
        "full_name": person["full_name"],
        "status": "Inside" if data.action == "Check In" else "Outside",
    }


# -------------------- ACCESS LOGS --------------------

@app.get("/visitor-access-logs")
def get_visitor_access_logs():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT v.id, v.full_name, v.flat_id, f.flat_number, f.building,
                       v.phone, v.purpose, v.status, v.created_at, v.exited_at,
                       v.is_archived, v.vehicle_number
                FROM visitors v
                JOIN flats f ON f.id=v.flat_id
                ORDER BY v.created_at DESC
            """)
            return cursor.fetchall()
