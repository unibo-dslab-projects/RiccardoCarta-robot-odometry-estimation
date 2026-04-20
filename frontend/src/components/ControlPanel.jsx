import { forwardRef } from 'react';

/**
 * ControlPanel component for robot movement and status management.
 * Handles keyboard shortcuts, button events, and form submissions for robot control.
 * Uses React synthetic events for better performance and cleaner code.
 */
const ControlPanel = forwardRef(function ControlPanel(
    {
        status,
        statusLabel,
        lastMovement,
        loading,
        onOpenMove,
        onOpenTurn,
        onSetStep,
        onRelax,
        onSaveMeasurement,
    },
    ref
) {
    /**
     * Handles step size form submission.
     * Validates input and calls onSetStep with the new value.
     * @param {Event} e - Form submit event
     */
    const handleStepSubmit = (e) => {
        e.preventDefault();
        const value = Number(e.target.stepSize.value);
        if (Number.isFinite(value)) {
            onSetStep(value);
        }
    };

    /**
     * Handles save measurement form submission.
     * Validates inputs and calls onSaveMeasurement with the new values.
     * @param {Event} e - Form submit event
     */
    const handleSaveSubmit = (e) => {
        e.preventDefault();
        const distanceX = Number(e.target.distanceX.value);
        const distanceY = Number(e.target.distanceY.value);
        if (Number.isFinite(distanceX) && Number.isFinite(distanceY)) {
            onSaveMeasurement(distanceX, distanceY);
            e.target.reset();
        }
    };

    /**
     * Handles keyboard shortcuts for robot control.
     * Maps specific keys to actions (move, turn, relax).
     * @param {KeyboardEvent} e - Keyboard event
     */
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

    return (
        <div
            ref={ref}
            className="grid two-columns"
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            <section className="panel">
                <h2>Movement Control</h2>

                <form className="inline-form" onSubmit={handleStepSubmit}>
                    <label>
                        Step Duration (ms)
                        <input
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
                            onClick={onOpenMove}
                            disabled={loading}
                            className="direction-btn"
                        >
                            Move
                        </button>

                        <button
                            type="button"
                            onClick={onOpenTurn}
                            disabled={loading}
                            className="secondary direction-btn"
                        >
                            Turn
                        </button>
                    </div>

                    <div className="action-row">
                        <button
                            type="button"
                            onClick={onRelax}
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
                        <span className="bold-text">{statusLabel.battery}</span>
                    </div>
                    <div>
                        <span>Percentage</span>
                        <span className="bold-text">{statusLabel.percent}</span>
                    </div>
                    <div>
                        <span>Distance to Object</span>
                        <span className="bold-text">{statusLabel.distance}</span>
                    </div>
                    <div>
                        <span>Current Step</span>
                        <span className="bold-text">{statusLabel.step}</span>
                    </div>
                </div>

                <div className="movement-summary">
                    <h3>Last Movement</h3>

                    {lastMovement ? (
                        <ul>
                            <li><span className="bold-text">ID:</span> {lastMovement.id}</li>
                            <li><span className="bold-text">Direction:</span> {lastMovement.direction}</li>
                            <li><span className="bold-text">Steps:</span> {lastMovement.steps}</li>
                            <li><span className="bold-text">Step Size:</span> {lastMovement.step_size} ms</li>
                            <li>
                                <span className="bold-text">Battery:</span>{' '}
                                {lastMovement.battery_volt.toFixed(2)} V
                            </li>
                        </ul>
                    ) : (
                        <p className="no-movement">No movement executed yet.</p>
                    )}
                </div>

                <form className="inline-form save-form" onSubmit={handleSaveSubmit}>
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
});

export default ControlPanel;