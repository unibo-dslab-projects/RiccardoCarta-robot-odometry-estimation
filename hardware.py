from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any

import requests

# Abstract base class defining the hardware interface
class BaseHardware(ABC):
    @abstractmethod
    def move(self, direction: str, steps: int, step_size: int) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def turn(self, direction: str, steps: int, step_size: int) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def stop(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def relax(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def read_battery(self) -> float:
        raise NotImplementedError

    @abstractmethod
    def read_distance(self) -> float:
        raise NotImplementedError

# Concrete implementation for robot hardware, communicates via HTTP
class RobotBridgeHardware(BaseHardware):
    def __init__(self, base_url: str | None = None, timeout: float = 20.0) -> None:
        # Set base URL from argument, environment variable, or default
        self.base_url = (base_url or os.getenv("ROBOT_SERVER_URL", "http://127.0.0.1:8001")).rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        # Build full URL and make HTTP request
        url = f"{self.base_url}{path}"
        try:
            response = requests.request(method, url, json=payload, timeout=self.timeout)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise RuntimeError(f"Cannot reach robot server at {url}: {exc}") from exc

        if not response.content:
            return {}

        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError(f"Robot server returned invalid JSON for {url}") from exc

        if not isinstance(data, dict):
            raise RuntimeError(f"Robot server returned an unexpected payload for {url}")
        return data

    def move(self, direction: str, steps: int, step_size: int) -> dict[str, Any]:
        # Send move command to robot
        return self._request(
            "POST",
            "/api/move",
            {"direction": direction, "steps": steps, "step_size": step_size},
        )

    def turn(self, direction: str, steps: int, step_size: int) -> dict[str, Any]:
        # Send turn command to robot
        return self._request(
            "POST",
            "/api/turn",
            {"direction": direction, "steps": steps, "step_size": step_size},
        )

    def stop(self) -> None:
        # Send stop command to robot
        self._request("POST", "/api/stop")

    def relax(self) -> None:
        # Send relax command to robot
        self._request("POST", "/api/relax")

    def read_battery(self) -> float:
        # Read battery voltage from robot
        data = self._request("GET", "/api/battery")
        return float(data["battery_volt"])

    def read_distance(self) -> float:
        # Read distance from robot
        data = self._request("GET", "/api/distance")
        return float(data["distance_cm"])

# Factory function to create a hardware instance
def create_hardware() -> BaseHardware:
    return RobotBridgeHardware()