import { useEffect, useRef } from 'react';
import TrajectoryMap from './TrajectoryMap.jsx';

/**
 * HistoryPanel component for displaying and managing robot movement history.
 * Shows a table of saved movements, summary statistics, and a trajectory map.
 */
export default function HistoryPanel({ movements, onRefresh, loading }) {
    // Ref for the refresh button to attach event listeners
    const refreshRef = useRef(null);

    // Normalize movements to array and compute summary stats
    const rows = Array.isArray(movements) ? [...movements] : [];
    const totalDistance = rows.reduce((sum, item) => sum + Number(item.distance_real || 0), 0);
    const latest = rows.length > 0 ? rows[rows.length - 1] : null;

    /**
     * Attaches click event listener to the refresh button.
     * Calls onRefresh if not currently loading.
     * Cleans up listener on unmount.
     */
    useEffect(() => {
        const btn = refreshRef.current;
        if (!btn) {
            return;
        }

        const handleClick = () => {
            if (!loading) {
                onRefresh();
            }
        };

        btn.addEventListener('click', handleClick);

        return () => {
            btn.removeEventListener('click', handleClick);
        };
    }, [onRefresh, loading]);

    return (
        <section className="panel history-panel">
            <div className="history-head">
                <div>
                    <h2>Saved Movements History</h2>
                    <p>Here you can find the table and the trajectory reconstructed from saved movements.</p>
                </div>
                <button type="button" ref={refreshRef} disabled={loading}>Refresh</button>
            </div>

            <div className="history-summary">
                <div><span>Records</span><span className="bold-text">{rows.length}</span></div>
                <div><span>Total distance</span><span className="bold-text">{totalDistance.toFixed(2)} cm</span></div>
                <div><span>Last save</span><span className="bold-text">{latest ? latest.timestamp : '—'}</span></div>
            </div>

            <div className="panel-subsection">
                <h3>Trajectory Map</h3>
                <TrajectoryMap movements={rows} />
            </div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Date</th>
                            <th>Dir.</th>
                            <th>Steps</th>
                            <th>Step size</th>
                            <th>Battery</th>
                            <th>Δx</th>
                            <th>Δy</th>
                            <th>Distance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="empty-cell">No saved data.</td>
                            </tr>
                        ) : (
                            rows.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.timestamp}</td>
                                    <td>{item.direction}</td>
                                    <td>{item.steps}</td>
                                    <td>{item.step_size}</td>
                                    <td>{Number(item.battery_volt).toFixed(2)}</td>
                                    <td>{Number(item.distance_x).toFixed(2)}</td>
                                    <td>{Number(item.distance_y).toFixed(2)}</td>
                                    <td>{Number(item.distance_real).toFixed(2)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}