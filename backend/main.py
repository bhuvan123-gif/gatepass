
import os
import secrets
import hashlib
import logging
from contextlib import contextmanager
from typing import Optional, Literal

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GatePass API", version="3.0.0")

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
                    status TEXT NOT NULL DEFAULT 'Inside',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    exited_at TIMESTAMP,
                    is_archived BOOLEAN NOT NULL DEFAULT FALSE
                )
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                ALTER TABLE visitors
                ADD COLUMN IF NOT EXISTS vehicle_number TEXT
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
    return {"message": "GatePass API is running", "version": "3.0.0"}


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
            cursor.execute(
                "SELECT id FROM flats WHERE id=%s FOR UPDATE",
                (flat_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            cursor.execute("""
                DELETE FROM secondary_person_movements
                WHERE person_id IN (
                    SELECT id FROM secondary_people WHERE flat_id=%s
                )
            """, (flat_id,))

            cursor.execute("""
                DELETE FROM resident_movements
                WHERE flat_id=%s
            """, (flat_id,))

            cursor.execute(
                "DELETE FROM secondary_people WHERE flat_id=%s",
                (flat_id,),
            )

            cursor.execute(
                "DELETE FROM visitors WHERE flat_id=%s",
                (flat_id,),
            )

            cursor.execute(
                "DELETE FROM residents WHERE flat_id=%s",
                (flat_id,),
            )

            cursor.execute(
                "DELETE FROM flats WHERE id=%s",
                (flat_id,),
            )

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
            cursor.execute(
                "SELECT id FROM flats WHERE id=%s",
                (data.flat_id,),
            )

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
            cursor.execute(
                "SELECT id FROM residents WHERE id=%s FOR UPDATE",
                (resident_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Resident not found")

            cursor.execute("""
                DELETE FROM secondary_person_movements
                WHERE person_id IN (
                    SELECT id FROM secondary_people WHERE resident_id=%s
                )
            """, (resident_id,))

            cursor.execute(
                "DELETE FROM secondary_people WHERE resident_id=%s",
                (resident_id,),
            )

            cursor.execute(
                "DELETE FROM resident_movements WHERE resident_id=%s",
                (resident_id,),
            )

            cursor.execute(
                "DELETE FROM residents WHERE id=%s",
                (resident_id,),
            )

        connection.commit()

    return Response(status_code=204)


# -------------------- VISITORS --------------------

@app.get("/visitors")
def get_visitors():
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


@app.post("/visitors")
def create_visitor(data: VisitorCreate):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM flats WHERE id=%s",
                (data.flat_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            cursor.execute("""
                INSERT INTO visitors
                    (full_name, flat_id, phone, purpose, status, vehicle_number)
                VALUES (%s, %s, %s, %s, 'Inside', %s)
                RETURNING *
            """, (
                data.full_name.strip(),
                data.flat_id,
                data.phone,
                data.purpose,
                (data.vehicle_number or "").strip() or None,
            ))

            visitor = cursor.fetchone()

        connection.commit()

    return visitor


@app.patch("/visitors/{visitor_id}/checkout")
def checkout_visitor(visitor_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE visitors
                SET status='Exited', exited_at=CURRENT_TIMESTAMP
                WHERE id=%s AND status='Inside' AND is_archived=FALSE
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
            cursor.execute(
                "DELETE FROM visitors WHERE id=%s RETURNING id",
                (visitor_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Visitor not found")

        connection.commit()

    return Response(status_code=204)


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
            cursor.execute(
                "SELECT id FROM flats WHERE id=%s",
                (data.flat_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Flat not found")

            if data.resident_id is not None:
                cursor.execute("""
                    SELECT id FROM residents
                    WHERE id=%s AND flat_id=%s AND is_active=TRUE
                """, (data.resident_id, data.flat_id))

                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=404,
                        detail="Active resident not found in this flat",
                    )

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
                raise HTTPException(
                    status_code=404,
                    detail="Active service provider not found",
                )

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
            cursor.execute(
                "SELECT id FROM secondary_people WHERE id=%s FOR UPDATE",
                (person_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail="Service provider not found",
                )

            cursor.execute(
                "DELETE FROM secondary_person_movements WHERE person_id=%s",
                (person_id,),
            )

            cursor.execute(
                "DELETE FROM secondary_people WHERE id=%s",
                (person_id,),
            )

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
        raise HTTPException(
            status_code=404,
            detail="Invalid or inactive QR code",
        )

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
        raise HTTPException(
            status_code=409,
            detail=f"{entity_name} is already checked in",
        )

    if requested_action == "Check Out" and not inside:
        raise HTTPException(
            status_code=409,
            detail=f"{entity_name} is not currently checked in",
        )


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
                raise HTTPException(
                    status_code=404,
                    detail="Active resident not found",
                )

            current = latest_action(
                cursor,
                "resident_movements",
                "resident_id",
                data.resident_id,
            )

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
                raise HTTPException(
                    status_code=404,
                    detail="Active service provider not found",
                )

            current = latest_action(
                cursor,
                "secondary_person_movements",
                "person_id",
                data.person_id,
            )

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
