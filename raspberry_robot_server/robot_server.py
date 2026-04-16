from __future__ import annotations

import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from Control import Control
from ADS7830 import ADS7830
from Ultrasonic import Ultrasonic

# Initialize FastAPI app
app = FastAPI(title="Robot Hardware Server")

# Initialize hardware interfaces
robot = Control()
adc = ADS7830()
ultrasonic = Ultrasonic()

MAX_VOLT = 8.4
MIN_VOLT = 5.0

# Pydantic model for motion requests
class MotionRequest(BaseModel):
    direction: str = Field(..., min_length=1)
    steps: int = Field(..., ge=1)
    step_size: int = Field(..., ge=1)

# Internal function to execute robot motion
def _run_motion(command: str, direction: str, steps: int, step_size: int) -> None:
    total_duration = (steps * step_size) / 1000.0
    if command == "move":
        mapping = {
            "f": robot.forWard,
            "b": robot.backWard,
            "l": robot.setpLeft,
            "r": robot.setpRight,
        }
    else:
        mapping = {
            "l": robot.turnLeft,
            "r": robot.turnRight,
        }

    if direction not in mapping:
        raise ValueError("Invalid direction")

    action = mapping[direction]
    start = time.perf_counter()
    while (time.perf_counter() - start) < total_duration:
        action()
        time.sleep(0.01)
    robot.stop()

# Get battery voltage endpoint
@app.get("/api/battery")
def battery():
    try:
        volt = float(adc.power(0))
        return {"battery_volt": volt}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Get distance from ultrasonic sensor endpoint
@app.get("/api/distance")
def distance():
    try:
        dist = float(ultrasonic.get_distance())
        return {"distance_cm": dist}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Get robot status endpoint
@app.get("/api/status")
def status():
    try:
        volt = float(adc.power(0))
        perc = (volt - MIN_VOLT) / (MAX_VOLT - MIN_VOLT) * 100
        dist = float(ultrasonic.get_distance())
        return {
            "battery_volt": round(volt, 2),
            "battery_perc": round(max(0.0, min(100.0, perc)), 2),
            "distance_from_object": round(dist, 2),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Move robot endpoint
@app.post("/api/move")
def move(request: MotionRequest):
    try:
        _run_motion("move", request.direction.lower().strip(), int(request.steps), int(request.step_size))
        return {"message": f"Moved {request.direction} for {request.steps} steps"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Turn robot endpoint
@app.post("/api/turn")
def turn(request: MotionRequest):
    try:
        _run_motion("turn", request.direction.lower().strip(), int(request.steps), int(request.step_size))
        return {"message": f"Turned {request.direction} for {request.steps} steps"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Stop robot endpoint
@app.post("/api/stop")
def stop():
    try:
        robot.stop()
        return {"message": "Robot stopped"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Relax robot endpoint
@app.post("/api/relax")
def relax():
    try:
        robot.relax(True)
        return {"message": "Robot relaxed"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))