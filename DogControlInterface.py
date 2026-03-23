import time
import os
import csv
import uuid
import math
from datetime import datetime

from Control import Control
from ADS7830 import ADS7830
from Ultrasonic import Ultrasonic

MAX_VOLT = 8.4
MIN_VOLT = 5.0

MAX_STEPS_SOFT = 50
MAX_STEPS_HARD = 100

FILENAME = "data_from_test.csv"


class DogControlInterface:
    def __init__(self):
        self.step_size = 1000
        self.robot = Control()
        self.adc = ADS7830()
        self.ultrasonic = Ultrasonic()
        self.last_movement = None

    def configure_step(self):
        while True:
            step_time = input("Insert step duration in ms: ").strip()
            if step_time.isdigit() and int(step_time) > 500:
                self.step_size = int(step_time)
                break
            print("Step value must be greater than 500")
        print(f"Configured step: {self.step_size} ms\n")

    def set_step(self, step_time):
        try:
            step_time = int(step_time)
            if step_time > 500:
                self.step_size = step_time
                print(f"Step size set to {self.step_size} ms")
            else:
                print("Step value must be greater than 500")
        except ValueError:
            print("Step value must be a valid number")

    def save_data(self, steps, direction, battery_volt, distance_x, distance_y, request_id=None):
        file_exists = os.path.isfile(FILENAME)
        if request_id is None:
            request_id = str(uuid.uuid4())

        distance_real = math.hypot(float(distance_x), float(distance_y))

        with open(FILENAME, mode="a", newline="") as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow([
                    "id",
                    "timestamp",
                    "step_size",
                    "steps",
                    "direction",
                    "battery_volt",
                    "distance_x_cm",
                    "distance_y_cm",
                    "distance_euclidean_cm",
                ])

            writer.writerow([
                request_id,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                self.step_size,
                steps,
                direction,
                f"{float(battery_volt):.2f}",
                f"{float(distance_x):.2f}",
                f"{float(distance_y):.2f}",
                f"{distance_real:.2f}",
            ])

        return request_id

    def move(self, direction, steps):
        total_duration = (steps * self.step_size) / 1000

        if direction == 'f':
            action = self.robot.forWard
        elif direction == 'b':
            action = self.robot.backWard
        elif direction == 'l':
            action = self.robot.setpLeft
        elif direction == 'r':
            action = self.robot.setpRight
        else:
            print("Invalid direction. Only allowed directions are: f, b, l, r")
            return False

        start_time = time.perf_counter()
        while (time.perf_counter() - start_time) < total_duration:
            action()
            time.sleep(0.01)

        self.robot.stop()
        return True

    def turn(self, direction, steps):
        total_duration = (steps * self.step_size) / 1000

        if direction == 'l':
            action = self.robot.turnLeft
        elif direction == 'r':
            action = self.robot.turnRight
        else:
            print("Invalid direction. Only allowed are: l, r")
            return False

        start_time = time.perf_counter()
        while (time.perf_counter() - start_time) < total_duration:
            action()
            time.sleep(0.01)

        self.robot.stop()
        return True

    def get_battery(self):
        return self.adc.power(0)

    def get_distance(self):
        return self.ultrasonic.get_distance()

    def relax(self):
        return self.robot.relax(True)

    def loop(self):
        print("Robot CLI ready.")
        print(
            "Available commands:\n"
            "\t- move <d> <steps>\n"
            "\t- turn <d> <steps>\n"
            "\t- setstep <step_time>\n"
            "\t- save <x_cm> <y_cm>\n"
            "\t- relax\n"
            "\t- quit"
        )

        while True:
            user_input = input(">>> ").strip().split()
            if not user_input:
                continue

            cmd = user_input[0].lower()

            if cmd == "quit":
                print("Exiting...")
                break

            if cmd == "relax":
                self.relax()
                continue

            if cmd == "setstep":
                if len(user_input) != 2:
                    print("Invalid command format. You must use: setstep <step_time>")
                    continue
                try:
                    step_time = int(user_input[1])
                    if step_time <= 0:
                        raise ValueError
                    self.set_step(step_time)
                except ValueError:
                    print("Step time must be a positive integer")
                continue

            if cmd == "move":
                if len(user_input) != 3:
                    print("Invalid command format. You must use: move <d> <steps>")
                    continue

                direction = user_input[1].lower()
                try:
                    steps = int(user_input[2])
                    if steps <= 0:
                        raise ValueError
                    if steps > MAX_STEPS_HARD:
                        print(f"Too many steps. Hard limit is {MAX_STEPS_HARD}")
                        continue
                    if steps > MAX_STEPS_SOFT:
                        confirm = input(f"High number of steps ({steps}). Continue? [y/N]: ").strip().lower()
                        if confirm != 'y':
                            continue
                except ValueError:
                    print("Steps must be a positive integer")
                    continue

                exec_start_time = time.perf_counter()
                ok = self.move(direction, steps)
                exec_end_time = time.perf_counter()

                if not ok:
                    continue

                total_time_s = exec_end_time - exec_start_time
                battery_volt = self.get_battery()
                battery_perc = (battery_volt - MIN_VOLT) / (MAX_VOLT - MIN_VOLT) * 100
                distance_from_object = self.get_distance()

                request_id = str(uuid.uuid4())
                self.last_movement = {
                    "id": request_id,
                    "direction": direction,
                    "steps": steps,
                    "battery_volt": battery_volt,
                }

                print(
                    "OUTPUT INFO\n"
                    f"\tCommand: move {direction} {steps}\n"
                    f"\tBattery: {battery_volt:.2f}V - {battery_perc:.1f}%\n"
                    f"\tDistance detected from nearest object: {distance_from_object}cm\n"
                    f"\tEstimated time: {total_time_s:.2f}s\n"
                    f"\tMovement id: {request_id}\n"
                    "Now save measured displacement with: save <x_cm> <y_cm>\n"
                )
                continue

            if cmd == "save":
                if len(user_input) != 3:
                    print("Invalid command format. You must use: save <x_cm> <y_cm>")
                    continue

                if not self.last_movement:
                    print("No movement available to save. Run a move command first.")
                    continue

                try:
                    distance_x = float(user_input[1])
                    distance_y = float(user_input[2])
                except ValueError:
                    print("x and y must be numeric values")
                    continue

                request_id = self.save_data(
                    steps=self.last_movement["steps"],
                    direction=self.last_movement["direction"],
                    battery_volt=self.last_movement["battery_volt"],
                    distance_x=distance_x,
                    distance_y=distance_y,
                    request_id=self.last_movement["id"]
                )
                print(f"Data saved successfully with id {request_id}")
                self.last_movement = None
                continue

            if cmd == "turn":
                if len(user_input) != 3:
                    print("Invalid command format. You must use: turn <d> <steps>")
                    continue

                direction = user_input[1].lower()
                try:
                    steps = int(user_input[2])
                    if steps <= 0:
                        raise ValueError
                    if steps > MAX_STEPS_HARD:
                        print(f"Too many steps. Hard limit is {MAX_STEPS_HARD}")
                        continue
                    if steps > MAX_STEPS_SOFT:
                        confirm = input(f"High number of steps ({steps}). Continue? [y/N]: ").strip().lower()
                        if confirm != 'y':
                            continue
                except ValueError:
                    print("Steps must be positive integer")
                    continue

                self.turn(direction, steps)
                continue

            print("Unknown command. Use move, turn, setstep, save, relax or quit")


if __name__ == "__main__":
    dci = DogControlInterface()
    dci.configure_step()
    dci.loop()