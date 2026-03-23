let lastMovement = null;

const canvas = document.getElementById("robotCanvas");
const ctx = canvas.getContext("2d");

const robotState = {
    x: 0,
    y: 0,
    history: [{ x: 0, y: 0 }]
};

document.addEventListener("DOMContentLoaded", () => {

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function getOrigin() {
        return {
            x: canvas.width / 2,
            y: canvas.height / 2
        };
    }

    function drawCanvas() {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const ORIGIN = {
            x: canvas.width / 2,
            y: canvas.height / 2
        };

        let maxDist = 1;

        robotState.history.forEach(p => {
            const dist = Math.max(Math.abs(p.x), Math.abs(p.y));
            if (dist > maxDist) maxDist = dist;
        });

        const padding = 20;
        const maxCanvasRadius = Math.min(canvas.width, canvas.height) / 2 - padding;

        const SCALE = maxCanvasRadius / maxDist;

        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, ORIGIN.y);
        ctx.lineTo(canvas.width, ORIGIN.y);
        ctx.moveTo(ORIGIN.x, 0);
        ctx.lineTo(ORIGIN.x, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;

        robotState.history.forEach((p, i) => {
            const px = ORIGIN.x + p.x * SCALE;
            const py = ORIGIN.y - p.y * SCALE;

            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });

        ctx.stroke();

        const last = robotState.history[robotState.history.length - 1];
        const rx = ORIGIN.x + last.x * SCALE;
        const ry = ORIGIN.y - last.y * SCALE;

        ctx.beginPath();
        ctx.fillStyle = "#dc2626";
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    function resetCanvasState() {
        robotState.x = 0;
        robotState.y = 0;
        robotState.history = [{ x: 0, y: 0 }];
        drawCanvas();
    }

    function setStep() {
        const stepSize = parseInt(document.getElementById('stepSize').value, 10);

        fetch('/setstep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step_time: stepSize }),
        });
    }

    function relax() {
        fetch('/relax', { method: 'POST' });
    }

    function turn(direction) {
        const steps = parseInt(document.getElementById('numSteps').value, 10);

        fetch('/turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction, steps }),
        });
    }

    function move(direction) {
        const steps = parseInt(document.getElementById('numSteps').value, 10);

        fetch('/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction, steps }),
        })
            .then(res => res.json())
            .then(data => {

                document.getElementById('batteryVolt').textContent =
                    `Battery Voltage: ${data.battery_volt.toFixed(2)}V`;

                document.getElementById('batteryPerc').textContent =
                    `Battery Percentage: ${data.battery_perc.toFixed(2)}%`;

                document.getElementById('distanceFromObject').textContent =
                    `Distance: ${data.distance_from_object}cm`;

                lastMovement = {
                    id: data.id,
                    direction,
                    steps,
                    battery_volt: data.battery_volt
                };
            });
    }

    function saveData() {
        if (!lastMovement) {
            console.warn("No movement to save");
            return;
        }

        const distanceXInput = document.getElementById("distanceX");
        const distanceYInput = document.getElementById("distanceY");

        const dx = parseFloat(distanceXInput.value);
        const dy = parseFloat(distanceYInput.value);

        if (isNaN(dx) || isNaN(dy)) {
            console.warn("Invalid input");
            return;
        }

        fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...lastMovement,
                distance_x: dx,
                distance_y: dy
            }),
        })
            .then(response => {
                if (!response.ok) throw new Error("Save failed");
                return response.json();
            })
            .then(() => {

                robotState.x += dx;
                robotState.y += dy;
                robotState.history.push({ x: robotState.x, y: robotState.y });

                drawCanvas();

                distanceXInput.value = "";
                distanceYInput.value = "";
                lastMovement = null;
            })
            .catch(err => console.error(err));
    }

    function updateStatus() {
        fetch('/battery')
            .then(r => r.json())
            .then(d => {
                document.getElementById('batteryVolt').textContent =
                    `${d.battery_volt.toFixed(2)} V`;
                document.getElementById('batteryPerc').textContent =
                    `${d.battery_perc.toFixed(2)} %`;
            });

        fetch('/distance')
            .then(r => r.json())
            .then(d => {
                document.getElementById('distanceFromObject').textContent =
                    `${d.distance_from_object} cm`;
            });
    }

    const buttons = document.querySelectorAll('.movement-buttons button');

    buttons[0].onclick = () => move('f');
    buttons[1].onclick = () => move('l');
    buttons[2].onclick = () => move('r');
    buttons[3].onclick = () => move('b');
    buttons[4].onclick = () => turn('l');
    buttons[5].onclick = () => turn('r');

    document.getElementById('setStepButton').onclick = setStep;
    document.querySelector('.relax-btn').onclick = relax;
    document.getElementById('saveButton').onclick = saveData;
    document.getElementById('resetCanvas').onclick = resetCanvasState;

    drawCanvas();
    updateStatus();
    setInterval(updateStatus, 5000);
});