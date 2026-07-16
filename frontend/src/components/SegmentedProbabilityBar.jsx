// Renders a single three-segment (home/draw/away) win-probability bar, used
// across Fixtures, GroupStage, TeamPage, and TournamentBracket wherever a
// prediction needs a compact visual instead of the plain ProbabilityBars.
// Default export: SegmentedProbabilityBar.

// Below this percentage, a segment's label is hidden rather than shown — a
// number doesn't legibly fit in a sliver that thin. home/draw/away are
// rounded in api.js so they always sum to exactly 100.
const THRESHOLD = 15

export default function SegmentedProbabilityBar({ prediction, home, away }) {
    return (
        <div className="pred-bar" style={{ width: '100%' }}>
            <div
                className="pred-bar__names"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <span style={{ flex: 1, textAlign: 'left' }}>{home.name}</span>
                <span className="pred-bar__sep">vs</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{away.name}</span>
            </div>
            <div className="pred-bar__track">
                {[
                    { pct: prediction.home, mod: 'home' },
                    { pct: prediction.draw, mod: 'draw' },
                    { pct: prediction.away, mod: 'away' },
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
