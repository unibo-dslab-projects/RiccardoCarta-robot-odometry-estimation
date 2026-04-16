import { useEffect, useMemo, useState, useRef } from 'react';
import ControlPanel from './components/ControlPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import MovementModal from './components/MovementModal.jsx';

/**
 * Default status object used to initialize the robot state.
 * Represents the expected structure of the robot's status API response.
 */
const emptyStatus = {
    battery_volt: 0,
    battery_perc: 0,
    distance_from_object: 0,
    step_size: 1000,
};

export default function App() {
    // State management
    const [view, setView] = useState('control');
    const [status, setStatus] = useState(emptyStatus);
    const [movements, setMovements] = useState([]);
    const [lastMovement, setLastMovement] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [modal, setModal] = useState({ open: false, isMove: true });

    // Refs for DOM elements to attach event listeners
    const controlRef = useRef(null);
    const historyRef = useRef(null);

    /**
     * Cached status labels for display purposes.
     * Formats raw numeric values into user-friendly strings with units.
     */
    const statusLabel = useMemo(() => ({
        battery: `${status.battery_volt?.toFixed?.(2) ?? '0.00'} V`,
        percent: `${status.battery_perc?.toFixed?.(1) ?? '0.0'} %`,
        distance: `${status.distance_from_object?.toFixed?.(2) ?? '0.00'} cm`,
        step: `${status.step_size} ms`,
    }), [status]);

    /**
     * Generic API request helper.
     * @param {string} path - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Parsed JSON response
     * @throws {Error} On non-OK HTTP responses
     */
    async function api(path, options) {
        const response = await fetch(path, options);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.detail || 'Request failed');
        }
        return payload;
    }

    /**
     * Fetches and updates the robot's current status.
     */
    async function refreshStatus() {
        const data = await api('/api/status');
        setStatus(data);
    }

    /**
     * Fetches and updates the movement history.
     * Normalizes the response to ensure movements is always an array.
     */
    async function refreshHistory() {
        const data = await api('/api/movements');
        setMovements(Array.isArray(data.items) ? data.items : []);
    }

    /**
     * Polls the robot's status every 5 seconds.
     * Uses cleanup pattern to avoid memory leaks and state updates after unmount.
     */
    useEffect(() => {
        let isMounted = true;
        async function loadStatus() {
            try {
                const data = await api('/api/status');
                if (isMounted) {
                    setStatus(data);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message);
                }
            }
        }
        loadStatus();
        const interval = setInterval(loadStatus, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Refresh history when view changes to 'history'
    useEffect(() => {
        if (view === 'history') {
            refreshHistory().catch((err) => setError(err.message));
        }
    }, [view]);

    // Auto-clear message after 3 seconds
    useEffect(() => {
        if (!message) {
            return;
        }
        const timeout = setTimeout(() => {
            setMessage('');
        }, 3000);

        return () => clearTimeout(timeout);
    }, [message]);

    /**
     * Sets up event listeners for tab buttons.
     * Uses refs to avoid re-renders and cleans up listeners on unmount.
     */
    useEffect(() => {
        const controlBtn = controlRef.current;
        const historyBtn = historyRef.current;

        const handleControl = () => setView('control');
        const handleHistory = () => setView('history');

        controlBtn?.addEventListener('click', handleControl);
        historyBtn?.addEventListener('click', handleHistory);

        return () => {
            controlBtn?.removeEventListener('click', handleControl);
            historyBtn?.removeEventListener('click', handleHistory);
        };
    }, []);

    /**
     * Opens the movement modal for move/turn actions.
     * @param {boolean} isMove - True for move, false for turn
     */
    function openMovementModal(isMove) {
        setModal({ open: true, isMove });
        setError('');
        setMessage('');
    }

    /**
     * Executes a move/turn action via API.
     * @param {Object} params - Action parameters
     * @param {string} params.direction - Movement/turn direction
     * @param {number} params.steps - Number of steps
     * @param {boolean} params.isMove - True for move, false for turn
     */
    async function handleExecuteAction({ direction, steps, isMove }) {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const endpoint = isMove ? '/api/move' : '/api/turn';
            const result = await api(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction, steps }),
            });

            setMessage(result.message || 'Operation completed');

            if (isMove) {
                setLastMovement(result);
            }

            await refreshStatus();
            setModal({ open: false, isMove: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Sets the step size via API.
     * @param {number} step_time - Step size in milliseconds
     */
    async function handleSetStep(step_time) {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const result = await api('/api/set-step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step_time }),
            });
            setMessage(result.message);
            await refreshStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Sends a relax command to the robot via API.
     */
    async function handleRelax() {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const result = await api('/api/relax', { method: 'POST' });
            setMessage(result.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Saves a movement measurement (distance_x, distance_y) via API.
     * Requires a previous movement to be executed (lastMovement).
     * @param {number} distance_x - Measured distance on x axis
     * @param {number} distance_y - Measured distance on y axis
     */
    async function handleSaveMeasurement(distance_x, distance_y) {
        if (!lastMovement) {
            setError('Execute a movement first to save.');
            return;
        }
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const result = await api('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: lastMovement.id,
                    direction: lastMovement.direction,
                    steps: lastMovement.steps,
                    step_size: lastMovement.step_size,
                    battery_volt: lastMovement.battery_volt,
                    distance_x,
                    distance_y,
                }),
            });
            setMessage(result.message);
            setLastMovement(null);
            await refreshHistory();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="container">
            <header className="topbar">
                <div>
                    <h1>Robot Dog Control</h1>
                </div>
                <div className="tabs">
                    <button ref={controlRef} className={view === 'control' ? 'active' : ''}>
                        Commands
                    </button>
                    <button ref={historyRef} className={view === 'history' ? 'active' : ''}>
                        History
                    </button>
                </div>
            </header>

            {error && <div className="notice error">{error}</div>}
            {message && <div className="notice success">{message}</div>}

            {view === 'control' ? (
                <ControlPanel
                    status={status}
                    statusLabel={statusLabel}
                    lastMovement={lastMovement}
                    loading={loading}
                    onOpenMove={() => openMovementModal(true)}
                    onOpenTurn={() => openMovementModal(false)}
                    onSetStep={handleSetStep}
                    onRelax={handleRelax}
                    onSaveMeasurement={handleSaveMeasurement}
                />
            ) : (
                view === 'history' && (
                    <HistoryPanel movements={movements} onRefresh={refreshHistory} loading={loading} />
                )
            )}

            {modal.open && (
                <MovementModal
                    isMove={modal.isMove}
                    onClose={() => setModal({ open: false, isMove: true })}
                    onConfirm={handleExecuteAction}
                    loading={loading}
                />
            )}
        </div>
    );
}