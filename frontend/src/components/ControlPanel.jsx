import { useRef, useEffect } from 'react';

/**
 * ControlPanel component for robot movement and status management.
 * Handles keyboard shortcuts, button events, and form submissions for robot control.
 */
export default function ControlPanel({
    status,
    statusLabel,
    lastMovement,
    loading,
    onOpenMove,
    onOpenTurn,
    onSetStep,
    onRelax,
    onSaveMeasurement,
}) {
    // Refs for form and button elements to attach event listeners
    const saveFormRef = useRef(null);
    const stepFormRef = useRef(null);
    const moveButtonRef = useRef(null);
    const turnButtonRef = useRef(null);
    const relaxButtonRef = useRef(null);

    /**
     * Sets up keyboard event listeners for robot control.
     * Maps specific keys to actions (move, turn, relax).
     * Cleans up listeners on unmount.
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (loading) {
                return;
            }

            const keyMap = {
                'm': 'move',
                'M': 'move',
                't': 'turn',
                'T': 'turn',
                ' ': 'relax',
                'r': 'relax',
                'R': 'relax',
            };

            const action = keyMap[e.key];
            if (!action) {
                return;
            }

            e.preventDefault();

            if (action === 'move') {
                onOpenMove();
            }
            if (action === 'turn') {
                onOpenTurn();
            }
            if (action === 'relax') {
                onRelax();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [loading, onOpenMove, onOpenTurn, onRelax]);

    /**
     * Attaches click event listeners to move, turn, and relax buttons.
     * Cleans up listeners on unmount.
     */
    useEffect(() => {
        const moveBtn = moveButtonRef.current;
        const turnBtn = turnButtonRef.current;
        const relaxBtn = relaxButtonRef.current;

        if (!moveBtn || !turnBtn || !relaxBtn) {
            return;
        }

        const handleMoveClick = () => onOpenMove();
        const handleTurnClick = () => onOpenTurn();
        const handleRelaxClick = () => onRelax();

        moveBtn.addEventListener('click', handleMoveClick);
        turnBtn.addEventListener('click', handleTurnClick);
        relaxBtn.addEventListener('click', handleRelaxClick);

        return () => {
            moveBtn.removeEventListener('click', handleMoveClick);
            turnBtn.removeEventListener('click', handleTurnClick);
            relaxBtn.removeEventListener('click', handleRelaxClick);
        };
    }, [onOpenMove, onOpenTurn, onRelax]);

    /**
     * Handles step size form submission.
     * Validates input and calls onSetStep with the new value.
     */
    useEffect(() => {
        const stepForm = stepFormRef.current;
        if (!stepForm) {
            return;
        }

        const handleStepSubmit = (event) => {
            event.preventDefault();
            const value = Number(event.target.stepSize.value);
            if (!Number.isFinite(value)) {
                return;
            }
            onSetStep(value);
        };

        stepForm.addEventListener('submit', handleStepSubmit);

        return () => {
            stepForm.removeEventListener('submit', handleStepSubmit);
        };
    }, [onSetStep]);

    /**
     * Handles save measurement form submission.
     * Validates inputs and calls onSaveMeasurement with the new values.
     */
    useEffect(() => {
        const saveForm = saveFormRef.current;
        if (!saveForm) {
            return;
        }

        const handleSaveSubmit = (event) => {
            event.preventDefault();

            const distanceX = Number(event.target.distanceX.value);
            const distanceY = Number(event.target.distanceY.value);

            if (!Number.isFinite(distanceX) || !Number.isFinite(distanceY)) {
                return;
            }

            onSaveMeasurement(distanceX, distanceY);
            saveForm.reset();
        };

        saveForm.addEventListener('submit', handleSaveSubmit);

        return () => {
            saveForm.removeEventListener('submit', handleSaveSubmit);
        };
    }, [onSaveMeasurement]);

    return (
        <div className="grid two-columns">
            <section className="panel">
                <h2>Movement Control</h2>

                <form className="inline-form" ref={stepFormRef}>
                    <label>
                        Step Duration (ms)
                        <input
                            key={status.step_size}
                            name="stepSize"
                            type="number"
                            min="500"
                            step="100"
                            defaultValue={status.step_size}
                        />
                    </label>
                    <button type="submit" disabled={loading}>
                        Update
                    </button>
                </form>

                <div className="control-section">
                    <p className="control-label">Select Action</p>

                    <div className="direction-grid">
                        <button
                            type="button"
                            ref={moveButtonRef}
                            disabled={loading}
                            className="direction-btn"
                        >
                            Move
                        </button>

                        <button
                            type="button"
                            ref={turnButtonRef}
                            disabled={loading}
                            className="secondary direction-btn"
                        >
                            Turn
                        </button>
                    </div>

                    <div className="action-row">
                        <button
                            type="button"
                            ref={relaxButtonRef}
                            disabled={loading}
                            className="secondary relax-btn"
                        >
                            Relax
                        </button>
                    </div>
                </div>
            </section>

            <section className="panel">
                <h2>Robot Status</h2>

                <div className="status-grid">
                    <div>
                        <span>Battery</span>
                        <span classname="bold-text">{statusLabel.battery}</span>
                    </div>
                    <div>
                        <span>Percentage</span>
                        <span classname="bold-text">{statusLabel.percent}</span>
                    </div>
                    <div>
                        <span>Distance to Object</span>
                        <span classname="bold-text">{statusLabel.distance}</span>
                    </div>
                    <div>
                        <span>Current Step</span>
                        <span classname="bold-text">{statusLabel.step}</span>
                    </div>
                </div>

                <div className="movement-summary">
                    <h3>Last Movement</h3>

                    {lastMovement ? (
                        <ul>
                            <li><span classname="bold-text">ID:</span> {lastMovement.id}</li>
                            <li><span classname="bold-text">Direction:</span> {lastMovement.direction}</li>
                            <li><span classname="bold-text">Steps:</span> {lastMovement.steps}</li>
                            <li><span classname="bold-text">Step Size:</span> {lastMovement.step_size} ms</li>
                            <li>
                                <span classname="bold-text">Battery:</span>{' '}
                                {lastMovement.battery_volt.toFixed(2)} V
                            </li>
                        </ul>
                    ) : (
                        <p className="no-movement">No movement executed yet.</p>
                    )}
                </div>

                <form className="inline-form save-form" ref={saveFormRef}>
                    <label>
                        Δx (cm)
                        <input
                            name="distanceX"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                        />
                    </label>

                    <label>
                        Δy (cm)
                        <input
                            name="distanceY"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            required
                        />
                    </label>

                    <button type="submit" disabled={loading || !lastMovement}>
                        Save
                    </button>
                </form>
            </section>
        </div>
    );
}