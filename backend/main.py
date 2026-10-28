from pydantic import BaseModel, Field
import os
from datetime import datetime, timezone

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="GatePass API",
    description="Society access and visitor management API",
    version="1.0.0",
)

# Temporary development configuration.
# Restrict this before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "app": "GatePass",
        "status": "running",
        "message": "GatePass API is online",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/db")
def database_health_check():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        return {"status": "error", "message": "Database configuration missing"}

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

        return {"status": "connected", "database": "PostgreSQL"}

    except Exception:
        return {
            "status": "error",
            "message": "Database connection failed. Check server configuration.",
        }


@app.post("/setup")
def setup_database():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        return {
            "status": "error",
            "message": "Database configuration missing"
        }

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS flats (
                        id BIGSERIAL PRIMARY KEY,
                        flat_number VARCHAR(30) NOT NULL UNIQUE,
                        building VARCHAR(50),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS residents (
                        id BIGSERIAL PRIMARY KEY,
                        full_name VARCHAR(100) NOT NULL,
                        flat_id BIGINT NOT NULL
                            REFERENCES flats(id) ON DELETE RESTRICT,
                        phone VARCHAR(20),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)

        return {
            "status": "success",
            "message": "Flats and residents tables are ready"
        }

    except Exception:
        return {
            "status": "error",
            "message": "Database setup failed"
        }

class FlatCreate(BaseModel):
    flat_number: str = Field(min_length=1, max_length=30)
    building: str | None = Field(default=None, max_length=50)


class ResidentCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    flat_id: int = Field(gt=0)
    phone: str | None = Field(default=None, max_length=20)

class VisitorCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    flat_id: int = Field(gt=0)
    phone: str = Field(min_length=1, max_length=20)
    purpose: str = Field(min_length=1, max_length=50)




@app.post("/flats")
def create_flat(flat: FlatCreate):
    database_url = os.getenv("DATABASE_URL")

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO flats (flat_number, building)
                    VALUES (%s, %s)
                    RETURNING id, flat_number, building, created_at
                    """,
                    (flat.flat_number.strip(), flat.building),
                )
                row = cursor.fetchone()

                return {
                    "id": row[0],
                    "flat_number": row[1],
                    "building": row[2],
                    "created_at": row[3],
                }

    except psycopg.errors.UniqueViolation:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail="This flat number is already registered",
        )
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Could not register flat",
        )


@app.post("/residents")



def create_resident(resident: ResidentCreate):
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Database configuration missing",
        )

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO residents (full_name, flat_id, phone)
                    VALUES (%s, %s, %s)
                    RETURNING id, full_name, flat_id, phone, created_at
                    """,
                    (
                        resident.full_name.strip(),
                        resident.flat_id,
                        resident.phone,
                    ),
                )
                row = cursor.fetchone()

                return {
                    "id": row[0],
                    "full_name": row[1],
                    "flat_id": row[2],
                    "phone": row[3],
                    "created_at": row[4],
                }

    except psycopg.errors.ForeignKeyViolation:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail="That flat ID does not exist",
        )
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Could not register resident",
        )

cur.execute("""
    CREATE TABLE IF NOT EXISTS visitors (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        flat_id BIGINT NOT NULL REFERENCES flats(id) ON DELETE RESTRICT,
        phone VARCHAR(20) NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Inside',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        exited_at TIMESTAMPTZ
    )
""")
@app.post("/visitors")
def create_visitor(visitor: VisitorCreate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO visitors (full_name, flat_id, phone, purpose)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, full_name, flat_id, phone, purpose,
                              status, created_at, exited_at
                    """,
                    (
                        visitor.full_name.strip(),
                        visitor.flat_id,
                        visitor.phone.strip(),
                        visitor.purpose.strip(),
                    ),
                )
                row = cur.fetchone()

                if row is None:
                    raise HTTPException(
                        status_code=500,
                        detail="Could not register visitor",
                    )

                return {
                    "id": row[0],
                    "full_name": row[1],
                    "flat_id": row[2],
                    "phone": row[3],
                    "purpose": row[4],
                    "status": row[5],
                    "created_at": row[6],
                    "exited_at": row[7],
                }

    except ForeignKeyViolation:
        raise HTTPException(
            status_code=404,
            detail="Destination flat not found",
        )

@app.get("/flats")
def list_flats():
    database_url = os.getenv("DATABASE_URL")

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, flat_number, building, created_at
                    FROM flats
                    ORDER BY flat_number
                    """
                )
                rows = cursor.fetchall()

                return [
                    {
                        "id": row[0],
                        "flat_number": row[1],
                        "building": row[2],
                        "created_at": row[3],
                    }
                    for row in rows
                ]

    except Exception:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve flats",
        )
        
@app.get("/residents")
def list_residents():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Database configuration missing",
        )

    try:
        with psycopg.connect(
            database_url,
            connect_timeout=5,
            sslmode="require",
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        r.id,
                        r.full_name,
                        r.flat_id,
                        f.flat_number,
                        f.building,
                        r.phone,
                        r.created_at
                    FROM residents r
                    JOIN flats f ON f.id = r.flat_id
                    ORDER BY r.full_name
                """)

                rows = cursor.fetchall()

                return [
                    {
                        "id": row[0],
                        "full_name": row[1],
                        "flat_id": row[2],
                        "flat_number": row[3],
                        "building": row[4],
                        "phone": row[5],
                        "created_at": row[6],
                    }
                    for row in rows
                ]

    except Exception:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve residents",
        )

