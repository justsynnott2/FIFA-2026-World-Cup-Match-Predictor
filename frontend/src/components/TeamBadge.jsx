export default function TeamBadge({ team }) {
  return (
    <span className="team-badge">
      <span>{team.code}</span>
      {team.name}
    </span>
  )
}
