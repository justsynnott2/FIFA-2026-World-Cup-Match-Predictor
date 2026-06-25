const THRESHOLD = 15

export default function PredictionBar({ home, draw, away, homeName, awayName }) {
    return (
        <div className="pred-bar" style={{ width: '100%' }}>
            <div
                className="pred-bar__names"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <span style={{ flex: 1, textAlign: 'left' }}>{homeName}</span>
                <span className="pred-bar__sep">vs</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{awayName}</span>
            </div>
            <div className="pred-bar__track">
                {[
                    { pct: home, mod: 'home' },
                    { pct: draw, mod: 'draw' },
                    { pct: away, mod: 'away' },
                ].map(({ pct, mod }) => (
                    <div
                        key={mod}
                        className={`pred-bar__seg pred-bar__seg--${mod}`}
                        style={{ width: `${pct}%` }}
                    >
                        {pct >= THRESHOLD && (
                            <span className="pred-bar__label">{pct}%</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
