
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
