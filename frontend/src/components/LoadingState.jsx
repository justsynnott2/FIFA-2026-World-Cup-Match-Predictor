/**
 * App's shared loading indicator — a broadcast lower-third strip styled to
 * echo SegmentedProbabilityBar's three-segment probability bar. `compact`
 * drops the label for tight inline spots (e.g. inside an already-labeled
 * card) and renders a shorter strip.
 */
export default function LoadingState({ label = 'Loading…', compact = false }) {
    return (
        <div
            className={`loading-state${compact ? ' loading-state--compact' : ''}`}
            aria-live="polite"
            aria-busy="true"
        >
            <div className="loading-state__strip" aria-hidden="true">
                <span className="loading-state__seg loading-state__seg--home" />
                <span className="loading-state__seg loading-state__seg--draw" />
                <span className="loading-state__seg loading-state__seg--away" />
            </div>
            {!compact && <p className="loading-state__label">{label}</p>}
        </div>
    )
}
