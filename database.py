from __future__ import annotations

import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

import mysql.connector

# Default MySQL connection settings, can be overridden by environment variables
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "robot_dog")
MYSQL_USER = os.getenv("MYSQL_USER", "robot")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "robotpass")
MYSQL_CONNECT_TIMEOUT = int(os.getenv("MYSQL_CONNECT_TIMEOUT", "10"))

# Flag to track if the database schema is ready
_SCHEMA_READY = False

def _connect() -> mysql.connector.MySQLConnection:
    # Create and return a new MySQL connection.
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        database=MYSQL_DATABASE,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        connection_timeout=MYSQL_CONNECT_TIMEOUT,
    )

@contextmanager
def _connection() -> Iterator[mysql.connector.MySQLConnection]:
    # Context manager for MySQL connections, ensures connection is closed after use.
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()

def init_db(retries: int = 5, delay: float = 1.0) -> None:
    # Initialize the database schema, retrying on failure.
    global _SCHEMA_READY
    ddl = """
    CREATE TABLE IF NOT EXISTS movements (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TEXT NOT NULL,
        direction VARCHAR(8) NOT NULL,
        steps INTEGER NOT NULL,
        step_size INTEGER NOT NULL,
        battery_volt DOUBLE NOT NULL,
        distance_x DOUBLE NOT NULL,
        distance_y DOUBLE NOT NULL,
        distance_real DOUBLE NOT NULL
    )
    """

    last_error: Exception | None = None
    for _ in range(max(1, retries)):
        try:
            with _connection() as conn:
                cur = conn.cursor()
                cur.execute(ddl)
                conn.commit()
            _SCHEMA_READY = True
            return
        except Exception as exc:
            last_error = exc
            time.sleep(delay)

    raise RuntimeError(f"Unable to initialize MySQL database: {last_error}") from last_error

def _ensure_schema() -> None:
    # Ensure the database schema is initialized before any operation.
    if not _SCHEMA_READY:
        init_db()

def insert_movement(
    movement_id: str,
    direction: str,
    steps: int,
    step_size: int,
    battery_volt: float,
    distance_x: float,
    distance_y: float,
) -> None:
    # Insert a new movement record into the database.
    _ensure_schema()

    distance_real = (float(distance_x) ** 2 + float(distance_y) ** 2) ** 0.5
    now = datetime.now().isoformat(timespec="seconds")

    sql = """
    INSERT INTO movements
        (id, timestamp, direction, steps, step_size, battery_volt, distance_x, distance_y, distance_real)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        movement_id,
        now,
        direction,
        int(steps),
        int(step_size),
        round(float(battery_volt), 2),
        round(float(distance_x), 2),
        round(float(distance_y), 2),
        round(distance_real, 2),
    )

    with _connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()

def fetch_movements(limit: int | None = None) -> list[dict[str, Any]]:
    # Fetch movement records from the database, optionally limited by count.
    _ensure_schema()

    sql = """
    SELECT id, timestamp, direction, steps, step_size, battery_volt, distance_x, distance_y, distance_real
    FROM movements
    ORDER BY timestamp DESC
    """
    if limit is not None:
        sql += f" LIMIT {int(limit)}"

    with _connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "id": row[0],
                "timestamp": row[1],
                "direction": row[2],
                "steps": int(row[3]),
                "step_size": int(row[4]),
                "battery_volt": float(row[5]),
                "distance_x": float(row[6]),
                "distance_y": float(row[7]),
                "distance_real": float(row[8]),
            }
        )
    return items