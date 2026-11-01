
import os
import secrets
import hashlib
import logging
from contextlib import contextmanager
from typing import Optional, Literal

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GatePass API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATABASE CONNECTION
# --------------------------------------------------

def get_database_url():
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("DATABASE_URL is not configured")

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    return url


@contextmanager
def db_connection():
    with psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
    ) as connection:
        yield connection


def hash_qr_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --------------------------------------------------
# DATABASE INITIALIZATION AND SAFE MIGRATIONS
# --------------------------------------------------

def init_database():
    with db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS flats (
                    id SERIAL PRIMARY KEY,
                    flat_number TEXT UNIQUE NOT NULL,
                    building TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                ALTER TABLE flats
                ADD COLUMN IF NOT EXISTS qr_token_hash TEXT UNIQUE
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS residents (
                    id SERIAL PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    flat_id INTEGER NOT NULL REFERENCES flats(id),
                    phone TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Existing residents remain active.
            cursor.execute("""
                ALTER TABLE residents
                ADD COLUMN IF NOT EXISTS is_active
                BOOLEAN NOT NULL DEFAULT TRUE
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
                    exited_at TIMESTAMP
                )
            """)

            # Existing visitors remain unarchived.
            cursor.execute("""
                ALTER TABLE visitors
                ADD COLUMN IF NOT EXISTS is_archived
                BOOLEAN NOT NULL DEFAULT FALSE
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
                    action TEXT NOT NULL CHECK (
                        action IN ('Check In', 'Check Out')
                    ),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        connection.commit()


@app.on_event("startup")
def startup():
    init_database()


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class FlatCreate(BaseModel):
    flat_number: str = Field(min_length=1)
    building: Optional[str] = None


class ResidentCreate(BaseModel):
    full_name: str = Field(min_length=1)
    flat_id: int
    phone: str = Field(pattern=r"^[0-9]{10}$")


class VisitorCreate(BaseModel):
    full_name: str = Field(min_length=1)
    flat_id: int
    phone: str = Field(pattern=r"^[0-9]{10}$")
    purpose: str = Field(min_length=1)


class SecondaryPersonCreate(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    category: str = Field(min_length=1)
    resident_id: Optional[int] = None
    flat_id: int


class QRValidateRequest(BaseModel):
    token: str = Field(min_length=1)


class ResidentMovementCreate(BaseModel):
    resident_id: int
    action: Literal["Check In", "Check Out"]
# --------------------------------------------------
# BASIC ROUTES AND HEALTH CHECKS
# --------------------------------------------------

@app.get("/")
def root():
    return {"message": "GatePass API is running"}


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
        raise HTTPException(
            status_code=500,
            detail="Database connection failed",
        )


# --------------------------------------------------
# FLATS
# --------------------------------------------------

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
                """, (
                    data.flat_number.strip(),
                    data.building,
                ))

                result = cursor.fetchone()

            connection.commit()
            return result

    except psycopg.errors.UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="Flat already exists",
        )

    except Exception:
        logger.exception("Could not create flat")
        raise HTTPException(
            status_code=500,
            detail="Could not create flat",
        )


@app.post("/flats/{flat_id}/qr")
def generate_flat_qr(flat_id: int):
    token = secrets.token_urlsafe(32)
    token_hash = hash_qr_token(token)

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE flats
                SET qr_token_hash = %s
                WHERE id = %s
                RETURNING id, flat_number, building
            """, (token_hash, flat_id))

            flat = cursor.fetchone()

            if not flat:
                raise HTTPException(
                    status_code=404,
                    detail="Flat not found",
                )

        connection.commit()

    return {
        "valid": True,
        "type": "flat",
        "flat": flat,
        "qr_token": token,
    }


# --------------------------------------------------
# RESIDENTS
# --------------------------------------------------

@app.get("/residents")
def get_residents():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    r.id,
                    r.full_name,
                    r.flat_id,
                    r.phone,
                    r.created_at,
                    f.flat_number,
                    f.building,
                    r.is_active
                FROM residents r
                JOIN flats f ON f.id = r.flat_id
                ORDER BY r.is_active DESC, r.full_name
            """)

            return cursor.fetchall()


@app.post("/residents")
def create_resident(data: ResidentCreate):
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM flats WHERE id = %s",
                    (data.flat_id,),
                )

                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=404,
                        detail="Flat not found",
                    )

                cursor.execute("""
                    INSERT INTO residents
                        (full_name, flat_id, phone)
                    VALUES (%s, %s, %s)
                    RETURNING id, full_name, flat_id, phone, created_at,
                              is_active
                """, (
                    data.full_name.strip(),
                    data.flat_id,
                    data.phone,
                ))

                resident = cursor.fetchone()

            connection.commit()
            return resident

    except HTTPException:
        raise

    except Exception:
        logger.exception("Could not create resident")
        raise HTTPException(
            status_code=500,
            detail="Could not create resident",
        )


@app.patch("/residents/{resident_id}/deactivate")
def deactivate_resident(resident_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT id
                FROM residents
                WHERE id = %s AND is_active = TRUE
                FOR UPDATE
            """, (resident_id,))

            resident = cursor.fetchone()

            if not resident:
                raise HTTPException(
                    status_code=404,
                    detail="Active resident not found",
                )

            cursor.execute("""
                SELECT action
                FROM resident_movements
                WHERE resident_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            """, (resident_id,))

            latest = cursor.fetchone()

            if latest and latest["action"] == "Check In":
                raise HTTPException(
                    status_code=409,
                    detail="Check out the resident before deactivating",
                )

            cursor.execute("""
                UPDATE residents
                SET is_active = FALSE
                WHERE id = %s
                RETURNING id, full_name, is_active
            """, (resident_id,))

            result = cursor.fetchone()

        connection.commit()

    return result


@app.patch("/residents/{resident_id}/reactivate")
def reactivate_resident(resident_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE residents
                SET is_active = TRUE
                WHERE id = %s AND is_active = FALSE
                RETURNING id, full_name, is_active
            """, (resident_id,))

            result = cursor.fetchone()

        connection.commit()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Inactive resident not found",
        )

    return result


# --------------------------------------------------
# VISITORS
# --------------------------------------------------

@app.get("/visitors")
def get_visitors():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    v.id,
                    v.full_name,
                    v.flat_id,
                    f.flat_number,
                    f.building,
                    v.phone,
                    v.purpose,
                    v.status,
                    v.created_at,
                    v.exited_at,
                    v.is_archived
                FROM visitors v
                JOIN flats f ON f.id = v.flat_id
                ORDER BY v.is_archived ASC, v.created_at DESC
            """)

            return cursor.fetchall()


@app.post("/visitors")
def create_visitor(data: VisitorCreate):
    with db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT id FROM flats WHERE id = %s",
                (data.flat_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail="Flat not found",
                )

            cursor.execute("""
                INSERT INTO visitors
                    (full_name, flat_id, phone, purpose, status)
                VALUES (%s, %s, %s, %s, 'Inside')
                RETURNING *
            """, (
                data.full_name.strip(),
                data.flat_id,
                data.phone,
                data.purpose,
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
                SET status = 'Exited',
                    exited_at = CURRENT_TIMESTAMP
                WHERE id = %s
                  AND status = 'Inside'
                  AND is_archived = FALSE
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


@app.patch("/visitors/{visitor_id}/archive")
def archive_visitor(visitor_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE visitors
                SET is_archived = TRUE
                WHERE id = %s
                  AND is_archived = FALSE
                  AND status != 'Inside'
                RETURNING id, full_name, is_archived
            """, (visitor_id,))

            result = cursor.fetchone()

        connection.commit()

    if not result:
        raise HTTPException(
            status_code=409,
            detail="Visitor not found, already archived, or still inside",
        )

    return result


@app.patch("/visitors/{visitor_id}/restore")
def restore_visitor(visitor_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE visitors
                SET is_archived = FALSE
                WHERE id = %s AND is_archived = TRUE
                RETURNING id, full_name, is_archived
            """, (visitor_id,))

            result = cursor.fetchone()

        connection.commit()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Archived visitor not found",
        )

    return result


# --------------------------------------------------
# SECONDARY PEOPLE / SERVICE PROVIDERS
# --------------------------------------------------

@app.get("/secondary-people")
def get_secondary_people():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    s.id,
                    s.full_name,
                    s.phone,
                    s.category,
                    s.resident_id,
                    s.flat_id,
                    s.active,
                    s.created_at,
                    r.full_name AS primary_resident,
                    f.flat_number,
                    f.building
                FROM secondary_people s
                LEFT JOIN residents r ON r.id = s.resident_id
                JOIN flats f ON f.id = s.flat_id
                ORDER BY s.created_at DESC
            """)

            return cursor.fetchall()


@app.post("/secondary-people")
def create_secondary_person(data: SecondaryPersonCreate):
    token = secrets.token_urlsafe(32)

    with db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute(
                "SELECT id FROM flats WHERE id = %s",
                (data.flat_id,),
            )

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail="Flat not found",
                )

            if data.resident_id is not None:
                cursor.execute("""
                    SELECT id
                    FROM residents
                    WHERE id = %s
                      AND flat_id = %s
                      AND is_active = TRUE
                """, (data.resident_id, data.flat_id))

                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=404,
                        detail="Active resident not found in this flat",
                    )

            cursor.execute("""
                INSERT INTO secondary_people
                    (full_name, phone, category, resident_id,
                     flat_id, qr_token_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, full_name, phone, category,
                          resident_id, flat_id, active, created_at
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


@app.patch("/secondary-people/{person_id}/deactivate")
def deactivate_secondary_person(person_id: int):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE secondary_people
                SET active = FALSE
                WHERE id = %s
                RETURNING id, full_name, active
            """, (person_id,))

            person = cursor.fetchone()

        connection.commit()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    return person


# --------------------------------------------------
# QR VALIDATION
# --------------------------------------------------

@app.post("/qr/validate")
def validate_qr(data: QRValidateRequest):
    token_hash = hash_qr_token(data.token)

    with db_connection() as connection:
        with connection.cursor() as cursor:

            cursor.execute("""
                SELECT id, flat_number, building
                FROM flats
                WHERE qr_token_hash = %s
            """, (token_hash,))

            flat = cursor.fetchone()

            if flat:
                cursor.execute("""
                    SELECT id, full_name, phone, flat_id
                    FROM residents
                    WHERE flat_id = %s
                      AND is_active = TRUE
                    ORDER BY full_name
                """, (flat["id"],))

                residents = cursor.fetchall()

                return {
                    "valid": True,
                    "type": "flat",
                    "flat": flat,
                    "residents": residents,
                }

            cursor.execute("""
                SELECT
                    s.id,
                    s.full_name,
                    s.phone,
                    s.category,
                    s.resident_id,
                    s.flat_id,
                    s.active,
                    r.full_name AS primary_resident,
                    f.flat_number,
                    f.building
                FROM secondary_people s
                LEFT JOIN residents r ON r.id = s.resident_id
                JOIN flats f ON f.id = s.flat_id
                WHERE s.qr_token_hash = %s
            """, (token_hash,))

            person = cursor.fetchone()

    if not person or not person["active"]:
        raise HTTPException(
            status_code=404,
            detail="Invalid or inactive QR code",
        )

    return {
        "valid": True,
        "type": "secondary",
        "person": person,
    }


# --------------------------------------------------
# RESIDENT MOVEMENTS / CHECK IN AND CHECK OUT
# --------------------------------------------------

@app.get("/resident-movements")
def get_resident_movements():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    m.id,
                    m.resident_id,
                    m.flat_id,
                    m.action,
                    m.created_at,
                    r.full_name,
                    r.phone,
                    f.flat_number,
                    f.building
                FROM resident_movements m
                JOIN residents r ON r.id = m.resident_id
                JOIN flats f ON f.id = m.flat_id
                ORDER BY m.created_at DESC, m.id DESC
            """)

            return cursor.fetchall()


@app.get("/resident-movements/current")
def get_current_resident_status():
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT ON (r.id)
                    r.id AS resident_id,
                    r.full_name,
                    r.flat_id,
                    f.flat_number,
                    f.building,
                    m.action,
                    m.created_at
                FROM residents r
                JOIN flats f ON f.id = r.flat_id
                LEFT JOIN resident_movements m ON m.id = (
                    SELECT m2.id
                    FROM resident_movements m2
                    WHERE m2.resident_id = r.id
                    ORDER BY m2.created_at DESC, m2.id DESC
                    LIMIT 1
                )
                WHERE r.is_active = TRUE
                ORDER BY r.id
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
                WHERE id = %s
                  AND is_active = TRUE
                FOR UPDATE
            """, (data.resident_id,))

            resident = cursor.fetchone()

            if not resident:
                raise HTTPException(
                    status_code=404,
                    detail="Active resident not found",
                )

            cursor.execute("""
                SELECT action
                FROM resident_movements
                WHERE resident_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            """, (data.resident_id,))

            latest = cursor.fetchone()

            currently_inside = bool(
                latest and latest["action"] == "Check In"
            )

            if data.action == "Check In" and currently_inside:
                raise HTTPException(
                    status_code=409,
                    detail="Resident is already checked in",
                )

            if data.action == "Check Out" and not currently_inside:
                raise HTTPException(
                    status_code=409,
                    detail="Resident is not currently checked in",
                )

            cursor.execute("""
                INSERT INTO resident_movements
                    (resident_id, flat_id, action)
                VALUES (%s, %s, %s)
                RETURNING id, resident_id, flat_id, action, created_at
            """, (
                data.resident_id,
                resident["flat_id"],
                data.action,
            ))

            movement = cursor.fetchone()

        connection.commit()

    return {
        **movement,
        "full_name": resident["full_name"],
        "status": (
            "Inside" if data.action == "Check In"
            else "Outside"
        ),
    }


# --------------------------------------------------
# VISITOR ACCESS LOGS
# Archived records are intentionally retained here.
# --------------------------------------------------

@app.get("/visitor-access-logs")
def get_visitor_access_logs():
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        v.id,
                        v.full_name,
                        v.flat_id,
                        f.flat_number,
                        f.building,
                        v.phone,
                        v.purpose,
                        v.status,
                        v.created_at,
                        v.exited_at,
                        v.is_archived
                    FROM visitors v
                    JOIN flats f ON f.id = v.flat_id
                    ORDER BY v.created_at DESC
                """)

                return cursor.fetchall()

    except Exception:
        logger.exception("Could not retrieve visitor access logs")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve visitor access logs",
        )
