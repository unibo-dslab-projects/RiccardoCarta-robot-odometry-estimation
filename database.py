import math
import sqlite3
from datetime import datetime

DB_FILE = "robot_data.db"


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS movements (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        direction TEXT,
        steps INTEGER,
        step_size INTEGER,
        battery_volt REAL,
        distance_x REAL,
        distance_y REAL,
        distance_real REAL
    )
    """)

    conn.commit()
    conn.close()


def insert_movement(
    movement_id: str,
    direction: str,
    steps: int,
    step_size: int,
    battery_volt: float,
    distance_x: float,
    distance_y: float
):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    distance_x = float(distance_x)
    distance_y = float(distance_y)
    distance_real = math.hypot(distance_x, distance_y)

    cursor.execute("""
    INSERT INTO movements
      (id, timestamp, direction, steps, step_size, battery_volt, distance_x, distance_y, distance_real)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        movement_id,
        datetime.now().isoformat(timespec="seconds"),
        direction,
        steps,
        step_size,
        round(float(battery_volt), 2),
        round(distance_x, 2),
        round(distance_y, 2),
        round(distance_real, 2)
    ))

    conn.commit()
    conn.close()