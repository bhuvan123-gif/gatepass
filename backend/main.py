import secrets
import hashlib
import os
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gatepass")

app = FastAPI(title="GatePass API", version="1.0.0")

# Allow the deployed frontend to call this API.
# For production, replace "*" with your exact frontend origin.
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
        raise RuntimeError("DATABASE_URL is not configured in Render.")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


@contextmanager
def db_connection():
    with psycopg.connect(
        get_database_url(),
        row_factory=dict_row,
        connect_timeout=10,
    ) as conn:
        yield conn


def init_database():
    with db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS flats (
                id SERIAL PRIMARY KEY,
                flat_number TEXT NOT NULL UNIQUE,
                building TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS residents (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                flat_id INTEGER NOT NULL REFERENCES flats(id),
                phone TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS visitors (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                flat_id INTEGER NOT NULL REFERENCES flats(id),
                phone TEXT NOT NULL,
                purpose TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Inside',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                exited_at TIMESTAMPTZ
            )
        """)
                conn.execute("""
            CREATE TABLE IF NOT EXISTS secondary_people (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT,
                category TEXT NOT NULL,
                resident_id INTEGER NOT NULL REFERENCES residents(id),
                flat_id INTEGER NOT NULL REFERENCES flats(id),
                qr_token_hash TEXT NOT NULL UNIQUE,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()


@app.on_event("startup")
def startup():
    try:
        init_database()
        logger.info("GatePass database initialized successfully.")
    except Exception:
        logger.exception("GatePass database initialization failed.")
        # Keep startup errors visible in Render logs.
        raise


class FlatCreate(BaseModel):
    flat_number: str = Field(min_length=1, max_length=50)
    building: str = Field(default="", max_length=100)


class ResidentCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    flat_id: int
    phone: str = Field(default="", max_length=30)

class SecondaryPersonCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(default="", max_length=30)
    category: str = Field(min_length=1, max_length=50)
    resident_id: int
    flat_id: int

class VisitorCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    flat_id: int
    phone: str = Field(min_length=1, max_length=30)
    purpose: str = Field(min_length=1, max_length=300)


@app.get("/")
def root():
    return {"message": "GatePass API is running", "docs": "/docs"}


@app.get("/health")
def health():
    try:
        with db_connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception:
        logger.exception("Health check database failure.")
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )


@app.get("/flats")
def get_flats():
    try:
        with db_connection() as conn:
            rows = conn.execute("""
                SELECT id, flat_number, building, created_at
                FROM flats
                ORDER BY building NULLS FIRST, flat_number
            """).fetchall()
        return rows
    except Exception:
        logger.exception("GET /flats failed")
        raise HTTPException(status_code=500, detail="Could not load flats")


@app.post("/flats", status_code=201)
def create_flat(data: FlatCreate):
    flat_number = data.flat_number.strip()
    building = data.building.strip() or None

    if not flat_number:
        raise HTTPException(status_code=422, detail="Flat number is required")

    try:
        with db_connection() as conn:
            row = conn.execute("""
                INSERT INTO flats (flat_number, building)
                VALUES (%s, %s)
                RETURNING id, flat_number, building, created_at
            """, (flat_number, building)).fetchone()
        return row
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="This flat already exists")
    except Exception:
        logger.exception("POST /flats failed")
        raise HTTPException(status_code=500, detail="Could not create flat")


@app.get("/residents")
def get_residents():
    try:
        with db_connection() as conn:
            rows = conn.execute("""
                SELECT
                    r.id, r.full_name, r.flat_id, r.phone, r.created_at,
                    f.flat_number, f.building
                FROM residents r
                JOIN flats f ON f.id = r.flat_id
                ORDER BY r.full_name
            """).fetchall()
        return rows
    except Exception:
        logger.exception("GET /residents failed")
        raise HTTPException(status_code=500, detail="Could not load residents")


@app.post("/residents", status_code=201)
def create_resident(data: ResidentCreate):
    try:
        with db_connection() as conn:
            row = conn.execute("""
                INSERT INTO residents (full_name, flat_id, phone)
                VALUES (%s, %s, %s)
                RETURNING id, full_name, flat_id, phone, created_at
            """, (
                data.full_name.strip(),
                data.flat_id,
                data.phone.strip() or None,
            )).fetchone()

            flat = conn.execute("""
                SELECT flat_number, building FROM flats WHERE id = %s
            """, (data.flat_id,)).fetchone()

            if not flat:
                raise HTTPException(status_code=404, detail="Flat not found")

            row["flat_number"] = flat["flat_number"]
            row["building"] = flat["building"]
        return row
    except HTTPException:
        raise
    except Exception:
        logger.exception("POST /residents failed")
        raise HTTPException(status_code=500, detail="Could not create resident")


@app.get("/visitors")
def get_visitors():
    try:
        with db_connection() as conn:
            rows = conn.execute("""
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
                    v.exited_at
                FROM visitors v
                JOIN flats f ON f.id = v.flat_id
                ORDER BY v.created_at DESC, v.id DESC
            """).fetchall()
        return rows
    except Exception:
        logger.exception("GET /visitors failed")
        raise HTTPException(status_code=500, detail="Could not load visitors")


@app.post("/visitors", status_code=201)
def create_visitor(data: VisitorCreate):
    try:
        with db_connection() as conn:
            flat = conn.execute("""
                SELECT id FROM flats WHERE id = %s
            """, (data.flat_id,)).fetchone()

            if not flat:
                raise HTTPException(status_code=404, detail="Flat not found")

            row = conn.execute("""
                INSERT INTO visitors
                    (full_name, flat_id, phone, purpose, status)
                VALUES (%s, %s, %s, %s, 'Inside')
                RETURNING id, full_name, flat_id, phone, purpose,
                          status, created_at, exited_at
            """, (
                data.full_name.strip(),
                data.flat_id,
                data.phone.strip(),
                data.purpose.strip(),
            )).fetchone()

            flat_details = conn.execute("""
                SELECT flat_number, building FROM flats WHERE id = %s
            """, (data.flat_id,)).fetchone()

            row["flat_number"] = flat_details["flat_number"]
            row["building"] = flat_details["building"]
        return row
    except HTTPException:
        raise
    except Exception:
        logger.exception("POST /visitors failed")
        raise HTTPException(status_code=500, detail="Could not register visitor")


@app.patch("/visitors/{visitor_id}/checkout")
def checkout_visitor(visitor_id: int):
    try:
        with db_connection() as conn:
            row = conn.execute("""
                UPDATE visitors
                SET status = 'Checked Out', exited_at = NOW()
                WHERE id = %s AND status = 'Inside'
                RETURNING id, full_name, status, exited_at
            """, (visitor_id,)).fetchone()

            if row:
                return row

            exists = conn.execute(
                "SELECT id, status FROM visitors WHERE id = %s",
                (visitor_id,),
            ).fetchone()

            if not exists:
                raise HTTPException(status_code=404, detail="Visitor not found")

            raise HTTPException(
                status_code=409,
                detail="Visitor has already checked out",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("PATCH visitor checkout failed")
        raise HTTPException(status_code=500, detail="Could not check out visitor")

def hash_qr_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@app.get("/secondary-people")
def get_secondary_people():
    try:
        with db_connection() as conn:
            rows = conn.execute("""
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
                    f.flat_number
                FROM secondary_people s
                JOIN residents r ON r.id = s.resident_id
                JOIN flats f ON f.id = s.flat_id
                ORDER BY s.created_at DESC
            """).fetchall()
        return rows
    except Exception:
        logger.exception("GET /secondary-people failed")
        raise HTTPException(
            status_code=500,
            detail="Could not load secondary people"
        )


@app.post("/secondary-people", status_code=201)
def create_secondary_person(data: SecondaryPersonCreate):
    token = secrets.token_urlsafe(32)
    token_hash = hash_qr_token(token)

    try:
        with db_connection() as conn:
            resident = conn.execute("""
                SELECT id, flat_id
                FROM residents
                WHERE id = %s
            """, (data.resident_id,)).fetchone()

            if not resident:
                raise HTTPException(
                    status_code=404,
                    detail="Primary resident not found"
                )

            if resident["flat_id"] != data.flat_id:
                raise HTTPException(
                    status_code=400,
                    detail="Resident does not belong to this flat"
                )

            row = conn.execute("""
                INSERT INTO secondary_people (
                    full_name, phone, category,
                    resident_id, flat_id, qr_token_hash
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, full_name, phone, category,
                          resident_id, flat_id, active, created_at
            """, (
                data.full_name.strip(),
                data.phone.strip(),
                data.category.strip(),
                data.resident_id,
                data.flat_id,
                token_hash
            )).fetchone()

        # The raw QR token is returned only at creation.
        return {
            **row,
            "qr_token": token
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("POST /secondary-people failed")
        raise HTTPException(
            status_code=500,
            detail="Could not register secondary person"
        )


@app.post("/qr/validate")
def validate_qr(data: dict):
    token = data.get("token", "")

    if not isinstance(token, str) or not token:
        raise HTTPException(status_code=400, detail="QR token required")

    token_hash = hash_qr_token(token)

    try:
        with db_connection() as conn:
            person = conn.execute("""
                SELECT
                    s.id,
                    s.full_name,
                    s.category,
                    s.active,
                    r.full_name AS primary_resident,
                    f.flat_number
                FROM secondary_people s
                JOIN residents r ON r.id = s.resident_id
                JOIN flats f ON f.id = s.flat_id
                WHERE s.qr_token_hash = %s
            """, (token_hash,)).fetchone()

        if not person or not person["active"]:
            raise HTTPException(
                status_code=404,
                detail="Invalid or inactive QR pass"
            )

        return {
            "valid": True,
            "person": person
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("QR validation failed")
        raise HTTPException(
            status_code=500,
            detail="Could not validate QR"
        )


@app.patch("/secondary-people/{person_id}/deactivate")
def deactivate_secondary_person(person_id: int):
    try:
        with db_connection() as conn:
            row = conn.execute("""
                UPDATE secondary_people
                SET active = FALSE
                WHERE id = %s
                RETURNING id, full_name, active
            """, (person_id,)).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Secondary person not found"
            )

        return row

    except HTTPException:
        raise
    except Exception:
        logger.exception("Deactivation failed")
        raise HTTPException(
            status_code=500,
            detail="Could not deactivate person"
        )
