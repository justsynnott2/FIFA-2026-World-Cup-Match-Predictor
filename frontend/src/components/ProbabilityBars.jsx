export default function ProbabilityBars({ prediction, home, away }) {
  const rows = [
    { label: `${home.code} win`, value: prediction.home, tone: 'home' },
    { label: 'Draw', value: prediction.draw, tone: 'draw' },
    { label: `${away.code} win`, value: prediction.away, tone: 'away' },
  ]

  return (
    <div className="probability-bars">
      {rows.map((row) => (
        <div className="probability-row" key={row.label}>
          <div className="probability-label">
            <span>{row.label}</span>
            <strong>{row.value}%</strong>
          </div>
          <div className="bar-track">
            <span className={`bar-fill ${row.tone}`} style={{ width: `${row.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
