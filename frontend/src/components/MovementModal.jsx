import { useState, useEffect, useRef } from 'react';

/**
 * MovementModal component for selecting and confirming robot movement or rotation actions.
 * Supports keyboard shortcuts for direction and step selection.
 */
export default function MovementModal({ isMove, onClose, onConfirm, loading }) {
    // State for direction and number of steps
    const [direction, setDirection] = useState('f');
    const [steps, setSteps] = useState(1);

    // Refs for DOM elements to attach event listeners
    const selectRef = useRef(null);
    const inputRef = useRef(null);
    const cancelRef = useRef(null);
    const executeRef = useRef(null);

    /**
     * Resets direction and steps when isMove changes.
     * Defaults to 'f' (forward) for move, 'l' (left) for turn.
     */
    useEffect(() => {
        if (isMove) {
            setDirection('f');
        } else {
            setDirection('l');
        }
        setSteps(1);
    }, [isMove]);

    /**
     * Returns a user-friendly label for the current direction.
     */
    const getDirectionLabel = () => {
        const labels = {
            'f': 'Forward',
            'b': 'Backward',
            'l': 'Left',
            'r': 'Right',
        };
        return labels[direction] || direction;
    };

    /**
     * Returns available direction options based on action type (move/turn).
     */
    const getDirectionOptions = () => {
        if (isMove) {
            return [
                { value: 'f', label: 'Forward' },
                { value: 'b', label: 'Backward' },
                { value: 'l', label: 'Left' },
                { value: 'r', label: 'Right' },
            ];
        } else {
            return [
                { value: 'l', label: 'Left' },
                { value: 'r', label: 'Right' },
            ];
        }
    };

    /**
     * Sets up keyboard event listeners for direction and step control.
     * WASD for direction, arrow keys for step count.
     * Cleans up listeners on unmount.
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (loading) {
                return;
            }

            const directionMap = {
                'w': 'f',
                'W': 'f',
                's': 'b',
                'S': 'b',
                'a': 'l',
                'A': 'l',
                'd': 'r',
                'D': 'r',
            };

            if (directionMap[e.key]) {
                e.preventDefault();
                const newDirection = directionMap[e.key];

                // For Move: all directions (W/S/A/D for f/b/l/r)
                // For Turn: only A/D (l/r)
                if (isMove) {
                    setDirection(newDirection);
                } else if (['a', 'A', 'd', 'D'].includes(e.key)) {
                    setDirection(newDirection);
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSteps(prev => Math.min(prev + 1, 100));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSteps(prev => Math.max(prev - 1, 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [loading, isMove]);

    /**
     * Attaches event listeners to form elements and action buttons.
     * Handles direction change, step input, cancel, and execute actions.
     * Cleans up listeners on unmount.
     */
    useEffect(() => {
        const selectEl = selectRef.current;
        const inputEl = inputRef.current;
        const cancelBtn = cancelRef.current;
        const executeBtn = executeRef.current;

        const handleSelectChange = (e) => {
            setDirection(e.target.value);
        };

        const handleInputChange = (e) => {
            setSteps(Math.max(1, Math.min(100, Number(e.target.value))));
        };

        const handleCancel = () => {
            if (!loading) {
                onClose();
            }
        };

        const handleExecute = () => {
            if (loading) {
                return;
            }
            if (steps < 1 || steps > 100) {
                return;
            }
            onConfirm({ direction, steps, isMove });
        };

        selectEl?.addEventListener('change', handleSelectChange);
        inputEl?.addEventListener('input', handleInputChange);
        cancelBtn?.addEventListener('click', handleCancel);
        executeBtn?.addEventListener('click', handleExecute);

        return () => {
            selectEl?.removeEventListener('change', handleSelectChange);
            inputEl?.removeEventListener('input', handleInputChange);
            cancelBtn?.removeEventListener('click', handleCancel);
            executeBtn?.removeEventListener('click', handleExecute);
        };
    }, [direction, steps, isMove, loading, onClose, onConfirm]);

    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
                <h2>{isMove ? 'Execute Movement' : 'Execute Rotation'}</h2>
                <p className="modal-hint">
                    {isMove
                        ? 'Choose direction (W/A/S/D) and number of steps (↑↓).'
                        : 'Choose rotation direction (A/D) and number of steps (↑↓).'
                    }
                </p>

                <label>
                    Direction {isMove ? '(WASD)' : '(A/D)'}
                    <select ref={selectRef} value={direction} disabled={loading}>
                        {getDirectionOptions().map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </label>

                <label>
                    Number of Steps (use ↑↓ or input)
                    <input
                        ref={inputRef}
                        type="number"
                        min="1"
                        max="100"
                        value={steps}
                        disabled={loading}
                        autoFocus
                    />
                </label>

                <div className="modal-preview">
                    <span classname="bold-text">Direction:</span> {getDirectionLabel()} <br />
                    <span classname="bold-text">Steps:</span> {steps}
                </div>

                <div className="modal-actions">
                    <button type="button" className="secondary" ref={cancelRef} disabled={loading}>
                        Cancel
                    </button>
                    <button type="button" ref={executeRef} disabled={loading}>
                        Execute
                    </button>
                </div>
            </div>
        </div>
    );
}