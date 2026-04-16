from __future__ import annotations

import math
import os
import uuid
from dataclasses import asdict, dataclass
from typing import Any

import database
from hardware import BaseHardware, create_hardware

# Constants for robot operation limits
MAX_VOLT = 8.4
MIN_VOLT = 5.0
MAX_STEPS_SOFT = 50  # First limit for steps, requires confirmation from the user
MAX_STEPS_HARD = 100  # Second limit for steps, cannot be exceeded
DEFAULT_STEP_SIZE = 1000
MIN_STEP_SIZE = 500

@dataclass
class MovementInfo:
    # Data class to store movement information
    id: str
    direction: str
    steps: int
    step_size: int
    battery_volt: float

class DogControlInterface:
    def __init__(self, hardware: BaseHardware | None = None) -> None:
        # Initialize with default step size and hardware
        self.step_size = int(DEFAULT_STEP_SIZE)
        self.hardware = hardware or create_hardware()
        self.last_movement: MovementInfo | None = None  # Track last movement for saving

    def set_step(self, step_time: int) -> int:
        # Set step time in milliseconds
        step_time = int(step_time)
        if step_time <= MIN_STEP_SIZE:
            raise ValueError(f"Step value must be greater than {MIN_STEP_SIZE} ms")
        self.step_size = step_time
        return self.step_size

    def _validate_motion(self, direction: str, steps: int, allowed: set[str]) -> tuple[str, int]:
        # Validate direction and steps for movement/turn commands
        direction = direction.lower().strip()
        if direction not in allowed:
            raise ValueError(f"Invalid direction. Allowed: {', '.join(sorted(allowed))}")
        steps = int(steps)
        if steps <= 0:
            raise ValueError("Steps must be a positive integer")
        if steps > MAX_STEPS_HARD:
            raise ValueError(f"Too many steps. Hard limit is {MAX_STEPS_HARD}")
        return direction, steps

    def get_battery(self) -> float:
        # Read current battery voltage from hardware
        return float(self.hardware.read_battery())

    def get_distance(self) -> float:
        # Read current distance from nearest object from hardware
        return float(self.hardware.read_distance())

    def get_status(self) -> dict[str, float]:
        # Return current robot status (battery, distance, step size)
        battery_volt = self.get_battery()
        battery_perc = (battery_volt - MIN_VOLT) / (MAX_VOLT - MIN_VOLT) * 100
        return {
            "battery_volt": round(battery_volt, 2),
            "battery_perc": round(max(0.0, min(100.0, battery_perc)), 2),
            "distance_from_object": round(self.get_distance(), 2),
            "step_size": self.step_size,
        }

    def move(self, direction: str, steps: int) -> dict[str, Any]:
        # Move robot in specified direction for given steps
        direction, steps = self._validate_motion(direction, steps, {"f", "b", "l", "r"})
        self.hardware.move(direction, steps, self.step_size)
        status = self.get_status()
        movement = MovementInfo(
            id=str(uuid.uuid4()),
            direction=direction,
            steps=steps,
            step_size=self.step_size,
            battery_volt=status["battery_volt"],
        )
        self.last_movement = movement
        return {
            **asdict(movement),
            "battery_perc": status["battery_perc"],
            "distance_from_object": status["distance_from_object"],
            "message": f"Moved {direction} for {steps} steps",
        }

    def turn(self, direction: str, steps: int) -> dict[str, Any]:
        # Turn robot in specified direction for given steps
        direction, steps = self._validate_motion(direction, steps, {"l", "r"})
        self.hardware.turn(direction, steps, self.step_size)
        return {"message": f"Turned {direction} for {steps} steps"}

    def relax(self) -> None:
        # Relax robot motors
        self.hardware.relax()

    def save_measurement(
        self,
        movement_id: str | None,
        direction: str,
        steps: int,
        step_size: int,
        battery_volt: float,
        distance_x: float,
        distance_y: float,
    ) -> dict[str, Any]:
        # Save movement measurement to database
        if movement_id is None:
            movement_id = self.last_movement.id if self.last_movement else None
        if movement_id is None:
            raise ValueError("No movement available to save")

        direction = direction.lower().strip()
        if direction not in {"f", "b", "l", "r"}:
            raise ValueError("Invalid direction. Allowed: f, b, l, r")
        if int(steps) <= 0:
            raise ValueError("Steps must be a positive integer")

        database.insert_movement(
            movement_id=movement_id,
            direction=direction,
            steps=int(steps),
            step_size=int(step_size),
            battery_volt=float(battery_volt),
            distance_x=float(distance_x),
            distance_y=float(distance_y),
        )

        if self.last_movement and self.last_movement.id == movement_id:
            self.last_movement = None  # Clear last movement after save

        distance_real = math.hypot(float(distance_x), float(distance_y))
        return {
            "id": movement_id,
            "message": "Data saved successfully",
            "distance_euclidean_cm": round(distance_real, 2),
        }

    def list_movements(self) -> list[dict[str, Any]]:
        # Fetch and return list of saved movements
        return database.fetch_movements()

    def loop(self) -> None:
        # Main CLI loop for robot control
        print("Robot CLI ready.")
        print(
            """Available commands:
    - move <d> <steps>
    - turn <d> <steps>
    - setstep <step_time>
    - save <x_cm> <y_cm>
    - status
    - relax
    - quit"""
        )

        while True:
            user_input = input(">>> ").strip().split()
            if not user_input:
                continue

            cmd = user_input[0].lower()

            if cmd == "quit":
                print("Exiting...")
                break

            if cmd == "status":
                status = self.get_status()
                print(
                    f"Battery: {status['battery_volt']:.2f}V ({status['battery_perc']:.1f}%) | "
                    f"Distance: {status['distance_from_object']:.2f} cm | Step size: {status['step_size']} ms"
                )
                continue

            if cmd == "relax":
                self.relax()
                print("Robot relaxed")
                continue

            if cmd == "setstep":
                if len(user_input) != 2:
                    print("Usage: setstep <step_time>")
                    continue
                try:
                    new_step = self.set_step(int(user_input[1]))
                    print(f"Step size set to {new_step} ms")
                except Exception as exc:
                    print(exc)
                continue

            if cmd == "move":
                if len(user_input) != 3:
                    print("Usage: move <d> <steps>")
                    continue
                try:
                    direction, steps = user_input[1], int(user_input[2])
                    if steps > MAX_STEPS_SOFT:
                        confirm = input(f"High number of steps ({steps}). Continue? [y/N]: ").strip().lower()
                        if confirm != "y":
                            continue
                    result = self.move(direction, steps)
                    print(
                        f"""Command: move {result['direction']} {result['steps']} | Battery: {result['battery_volt']:.2f}V | Distance: {result['distance_from_object']:.2f}cm
Movement id: {result['id']}
Now save measured displacement with: save <x_cm> <y_cm>"""
                    )
                except Exception as exc:
                    print(exc)
                continue

            if cmd == "turn":
                if len(user_input) != 3:
                    print("Usage: turn <d> <steps>")
                    continue
                try:
                    direction, steps = user_input[1], int(user_input[2])
                    if steps > MAX_STEPS_SOFT:
                        confirm = input(f"High number of steps ({steps}). Continue? [y/N]: ").strip().lower()
                        if confirm != "y":
                            continue
                    print(self.turn(direction, steps)["message"])
                except Exception as exc:
                    print(exc)
                continue

            if cmd == "save":
                if len(user_input) != 3:
                    print("Usage: save <x_cm> <y_cm>")
                    continue
                if self.last_movement is None:
                    print("No movement available to save. Run a move command first.")
                    continue
                try:
                    dx = float(user_input[1])
                    dy = float(user_input[2])
                    result = self.save_measurement(
                        movement_id=self.last_movement.id,
                        direction=self.last_movement.direction,
                        steps=self.last_movement.steps,
                        step_size=self.last_movement.step_size,
                        battery_volt=self.last_movement.battery_volt,
                        distance_x=dx,
                        distance_y=dy,
                    )
                    print(f"Data saved successfully with id {result['id']}")
                except Exception as exc:
                    print(exc)
                continue

            print("Unknown command. Use move, turn, setstep, save, status, relax or quit")

if __name__ == "__main__":
    dci = DogControlInterface()
    dci.loop()