from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from DogControlInterface import DogControlInterface

# Initialize FastAPI app
app = FastAPI(title="Robot Dog API")
# Enable CORS for all origins, methods, and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize robot control interface
dci = DogControlInterface()

# Pydantic model for move request
class MoveRequest(BaseModel):
    direction: str = Field(..., min_length=1)
    steps: int = Field(..., ge=1)

# Pydantic model for turn request
class TurnRequest(BaseModel):
    direction: str = Field(..., min_length=1)
    steps: int = Field(..., ge=1)

# Pydantic model for step time request
class StepRequest(BaseModel):
    step_time: int = Field(..., ge=1)

# Pydantic model for save measurement request
class SaveRequest(BaseModel):
    id: str
    direction: str
    steps: int
    step_size: int
    battery_volt: float
    distance_x: float
    distance_y: float

# Get robot status endpoint
@app.get("/api/status")
def status():
    try:
        return dci.get_status()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Move robot endpoint
@app.post("/api/move")
def move(request: MoveRequest):
    try:
        return dci.move(request.direction, request.steps)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Turn robot endpoint
@app.post("/api/turn")
def turn(request: TurnRequest):
    try:
        return dci.turn(request.direction, request.steps)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Set step time endpoint
@app.post("/api/set-step")
def set_step(request: StepRequest):
    try:
        step = dci.set_step(request.step_time)
        return {"message": f"Step size set to {step} ms", "step_size": step}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Relax robot endpoint
@app.post("/api/relax")
def relax():
    try:
        dci.relax()
        return {"message": "Robot is now relaxed"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# Save movement measurement endpoint
@app.post("/api/save")
def save(request: SaveRequest):
    try:
        return dci.save_measurement(
            movement_id=request.id,
            direction=request.direction,
            steps=request.steps,
            step_size=request.step_size,
            battery_volt=request.battery_volt,
            distance_x=request.distance_x,
            distance_y=request.distance_y,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# List all movements endpoint
@app.get("/api/movements")
def movements():
    try:
        return {"items": dci.list_movements()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))