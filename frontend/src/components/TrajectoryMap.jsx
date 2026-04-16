/**
 * Builds an array of trajectory points from movement data.
 * Filters movements from the last hour, sorts them chronologically,
 * and calculates cumulative x/y positions.
 *
 * @param {Array} movements - Array of movement objects
 * @returns {Array} Array of {x, y, label, id, direction} points
 */
function buildTrajectoryPoints(movements) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const ordered = [...movements]
        .filter((item) => item && item.timestamp && new Date(item.timestamp).getTime() >= oneHourAgo)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const points = [{ x: 0, y: 0, label: 'Start' }];
    let currentX = 0;
    let currentY = 0;

    for (const item of ordered) {
        const dx = Number(item.distance_x || 0);
        const dy = Number(item.distance_y || 0);
        currentX += dx;
        currentY += dy;
        points.push({
            x: currentX,
            y: currentY,
            label: item.timestamp,
            id: item.id,
            direction: item.direction,
        });
    }

    return points;
}

/**
 * Calculates the bounding box for a set of points, with padding.
 * Ensures a minimum span for visibility and adds 20% padding.
 *
 * @param {Array} points - Array of {x, y} points
 * @returns {Object} {minX, minY, width, height} bounding box
 */
function fitPoints(points) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const MIN_SPAN = 50;

    const spanX = Math.max(MIN_SPAN, maxX - minX);
    const spanY = Math.max(MIN_SPAN, maxY - minY);

    const pad = Math.max(spanX, spanY) * 0.2;

    return {
        minX: minX - pad,
        minY: minY - pad,
        width: spanX + pad * 2,
        height: spanY + pad * 2,
    };
}

/**
 * TrajectoryMap component for visualizing robot movement as a 2D path.
 * Shows the trajectory of the last hour, with start/end points highlighted.
 */
export default function TrajectoryMap({ movements }) {
    const points = buildTrajectoryPoints(Array.isArray(movements) ? movements : []);

    if (points.length <= 1) {
        return (
            <div className="trajectory-empty">
                The trajectory will appear here after saving at least one movement.
            </div>
        );
    }

    const fitted = fitPoints(points);
    const polyline = points.map((p) => `${p.x},${-p.y}`).join(' ');
    const start = points[0];
    const end = points[points.length - 1];

    return (
        <div className="trajectory-wrap">
            <div className="trajectory-subtitle">
                (based only on the  last 60 minutes)
            </div>

            <svg
                className="trajectory-map"
                viewBox={`${fitted.minX} ${-fitted.height - fitted.minY} ${fitted.width} ${fitted.height}`}
                role="img"
                aria-label="Robot trajectory map (last hour)"
            >
                <defs>
                    <marker
                        id="arrow-end"
                        markerWidth="4"
                        markerHeight="4"
                        refX="3"
                        refY="2"
                        orient="auto"
                        markerUnits="strokeWidth"
                    >
                        <path d="M0,0 L4,2 L0,4 z" />
                    </marker>
                </defs>

                <line x1="0" y1={-fitted.height - fitted.minY} x2="0" y2={-fitted.minY} className="axis-line" />
                <line x1={fitted.minX} y1={-0} x2={fitted.minX + fitted.width} y2={-0} className="axis-line" />

                <polyline
                    points={polyline}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1"
                    markerEnd="url(#arrow-end)"
                />
                {points.map((point, index) => {
                    let className;
                    if (index === 0) {
                        className = 'trajectory-start';
                    } else if (index === points.length - 1) {
                        className = 'trajectory-end';
                    } else {
                        className = 'trajectory-point';
                    }
                    return (
                        <circle
                            key={`${point.label}-${index}`}
                            cx={point.x}
                            cy={-point.y}
                            r="1.5"
                            className={className}
                        />
                    );
                })}
            </svg>

            <div className="trajectory-legend">
                <div><span className="bold-text">Start</span><span>{start.x.toFixed(2)}, {start.y.toFixed(2)}</span></div>
                <div><span className="bold-text">End</span><span>{end.x.toFixed(2)}, {end.y.toFixed(2)}</span></div>
            </div>
        </div>
    );
}