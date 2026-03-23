from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid

from DogControlInterface import DogControlInterface, MIN_VOLT, MAX_VOLT
import database

app = FastAPI()
app.mount("/web", StaticFiles(directory="./web", html=True), name="web")

database.init_db()


class MoveRequest(BaseModel):
    direction: str
    steps: int


class TurnRequest(BaseModel):
    direction: str
    steps: int


class SetStepRequest(BaseModel):
    step_time: int


class SaveRequest(BaseModel):
    id: str
    direction: str
    steps: int
    battery_volt: float
    distance_x: float
    distance_y: float


dci = DogControlInterface()


@app.post("/move")
async def move(request: MoveRequest):
    try:
        direction = request.direction.lower()
        if direction not in {"f", "b", "l", "r"}:
            raise HTTPException(status_code=400, detail="Invalid direction. Allowed: f, b, l, r")
        if request.steps <= 0:
            raise HTTPException(status_code=400, detail="Steps must be a positive integer")

        request_id = str(uuid.uuid4())
        ok = dci.move(direction, request.steps)
        if not ok:
            raise HTTPException(status_code=400, detail="Movement failed")

        battery_volt = dci.get_battery()
        battery_perc = (battery_volt - MIN_VOLT) / (MAX_VOLT - MIN_VOLT) * 100
        distance_from_object = dci.get_distance()

        return {
            "id": request_id,
            "message": f"Moved {direction} for {request.steps} steps",
            "battery_volt": battery_volt,
            "battery_perc": battery_perc,
            "distance_from_object": distance_from_object
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/save")
async def save_data(request: SaveRequest):
    try:
        direction = request.direction.lower()
        if direction not in {"f", "b", "l", "r"}:
            raise HTTPException(status_code=400, detail="Invalid direction. Allowed: f, b, l, r")

        database.insert_movement(
            movement_id=request.id,
            direction=direction,
            steps=request.steps,
            step_size=dci.step_size,
            battery_volt=request.battery_volt,
            distance_x=request.distance_x,
            distance_y=request.distance_y
        )

        distance_real = (request.distance_x ** 2 + request.distance_y ** 2) ** 0.5

        return {
            "id": request.id,
            "message": "Data saved successfully",
            "distance_euclidean_cm": round(distance_real, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/turn")
async def turn(request: TurnRequest):
    try:
        direction = request.direction.lower()
        if direction not in {"l", "r"}:
            raise HTTPException(status_code=400, detail="Invalid direction. Allowed: l, r")
        if request.steps <= 0:
            raise HTTPException(status_code=400, detail="Steps must be a positive integer")

        ok = dci.turn(direction, request.steps)
        if not ok:
            raise HTTPException(status_code=400, detail="Turn failed")

        return {"message": f"Turned {direction} for {request.steps} steps"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/setstep")
async def set_step(request: SetStepRequest):
    try:
        dci.set_step(request.step_time)
        return {"message": f"Step size set to {request.step_time} ms"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/relax")
async def relax():
    try:
        dci.relax()
        return {"message": "Robot is now relaxed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/battery")
async def get_battery():
    try:
        battery_volt = dci.get_battery()
        battery_perc = (battery_volt - MIN_VOLT) / (MAX_VOLT - MIN_VOLT) * 100
        return {
            "battery_volt": battery_volt,
            "battery_perc": battery_perc
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/distance")
async def get_distance():
    try:
        distance = dci.get_distance()
        return {"distance_from_object": distance}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))