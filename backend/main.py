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
        return {"status": "error", "message": "Database configuration missing"}

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

        return {
            "status": "success",
            "message": "Flats table is ready"
        }

    except Exception:
        return {
            "status": "error",
            "message": "Database setup failed"
        }

class FlatCreate(BaseModel):
    flat_number: str = Field(min_length=1, max_length=30)
    building: str | None = Field(default=None, max_length=50)


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
