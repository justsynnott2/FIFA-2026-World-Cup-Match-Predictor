import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAllFixtures, getTeamSquad, getTeamNews } from '../utils/api'
import { allTeams } from '../data/tournament'
import { isMatchLive, isMatchCompleted } from '../utils/matchStatus'

const SQUAD_SECTIONS = [
  { key: 'GK',  label: 'Goalkeepers' },
  { key: 'DEF', label: 'Defenders'   },
  { key: 'MID', label: 'Midfielders' },
  { key: 'FWD', label: 'Forwards'    },
]

function formatMatchDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function TeamFixtureCard({ fixture, currentEspnId }) {
  const navigate = useNavigate()
  const completed = isMatchCompleted(fixture.status)
  const live = isMatchLive(fixture.status)
  const homeIsSelf = fixture.home_espn_id === currentEspnId
  const awayIsSelf = fixture.away_espn_id === currentEspnId

  return (
    <article className="fixture-card">
      <div className="fixture-card__meta">
        <span>{formatMatchDate(fixture.date)}</span>
        <span>{fixture.venue}, {fixture.city}</span>
      </div>
      <div className="fixture-card__teams">
        <div className="fixture-card__team">
          <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />
          <span
            className={`fixture-card__name${homeIsSelf ? '' : ' team-name-link'}`}
            onClick={homeIsSelf ? undefined : () => navigate(`/team/${fixture.home_espn_id}`)}
          >
            {fixture.home_team}
          </span>
        </div>
        <div className="fixture-card__score">
          {completed
            ? <strong>{fixture.home_score} – {fixture.away_score}</strong>
            : live
              ? (
                <div className="fixture-card__live">
                  <strong>{fixture.home_score} – {fixture.away_score}</strong>
                  <span className="live-badge">LIVE</span>
                </div>
              )
              : <span className="fixture-card__vs">vs</span>
          }
        </div>
        <div className="fixture-card__team fixture-card__team--away">
          <span
            className={`fixture-card__name${awayIsSelf ? '' : ' team-name-link'}`}
            onClick={awayIsSelf ? undefined : () => navigate(`/team/${fixture.away_espn_id}`)}
          >
            {fixture.away_team}
          </span>
          <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />
        </div>
      </div>
    </article>
  )
}

export default function TeamPage() {
  const { espnId } = useParams()

  const [allFixtures, setAllFixtures] = useState(null)
  const [squad, setSquad] = useState(null)
  const [news, setNews] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      const [fixtures, squadData, newsData] = await Promise.all([
        getAllFixtures(),
        getTeamSquad(espnId),
        getTeamNews(espnId),
      ])
      setAllFixtures(fixtures)
      setSquad(squadData)
      setNews(newsData)
    }
    fetchAll()
  }, [espnId])

  if (!allFixtures) {
    return <section className="page"><p className="empty-state">Loading…</p></section>
  }

  const identityFixture = allFixtures.find(
    (f) => f.home_espn_id === espnId || f.away_espn_id === espnId
  )
  if (!identityFixture) {
    return <section className="page"><p className="empty-state">Team not found.</p></section>
  }

  const isHome = identityFixture.home_espn_id === espnId
  const teamName = isHome ? identityFixture.home_team : identityFixture.away_team
  const teamCode = isHome ? identityFixture.home_code : identityFixture.away_code
  const teamLogo = isHome ? identityFixture.home_logo : identityFixture.away_logo

  const teamMeta = allTeams.find((t) => t.code === teamCode)
  const confederation = teamMeta?.confederation ?? ''

  const teamFixtures = allFixtures.filter(
    (f) => f.home_espn_id === espnId || f.away_espn_id === espnId
  )

  const roster = squad?.roster ?? { GK: [], DEF: [], MID: [], FWD: [] }
  const hasAnyPlayers = SQUAD_SECTIONS.some(({ key }) => roster[key]?.length > 0)

  return (
    <section className="page team-page">

      {/* Team Hero */}
      <div className="team-hero">
        <div className="team-hero__text">
          <h1 className="team-hero__name">{teamName}</h1>
          <div className="team-hero__meta">
            <span>{teamCode}</span>
            {confederation && (
              <>
                <span aria-hidden="true">·</span>
                <span>{confederation}</span>
              </>
            )}
          </div>
        </div>
        <img src={teamLogo} alt={teamName} className="team-hero__logo" />
      </div>

      {/* Two-column content */}
      <div className="team-content">

        {/* Left — Squad */}
        <div className="team-col--roster">
          <h2>Squad</h2>
          {!squad ? (
            <p className="empty-state">Loading squad…</p>
          ) : !hasAnyPlayers ? (
            <p className="empty-state">Squad not yet available.</p>
          ) : (
            <div className="squad-sections">
              {SQUAD_SECTIONS.map(({ key, label }) => {
                const players = roster[key] ?? []
                if (players.length === 0) return null
                return (
                  <div key={key} className="squad-section">
                    <h3 className="squad-section__label">{label}</h3>
                    <ul className="player-list">
                      {players.map((player) => (
                        <li key={player.id} className="player-row">
                          <span className="player-number">{player.number || '—'}</span>
                          <span className="player-name">{player.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right — Fixtures + News */}
        <div className="team-col--right">

          {/* Group Stage Fixtures */}
          <div>
            <h2>Group Stage Fixtures</h2>
            <div className="fixture-list" style={{ marginTop: '1rem' }}>
              {teamFixtures.map((f) => (
                <TeamFixtureCard key={f.fixture_id} fixture={f} currentEspnId={espnId} />
              ))}
            </div>
          </div>

          {/* News */}
          <div>
            <h2>News</h2>
            {!news ? (
              <p className="empty-state">Loading news…</p>
            ) : news.length === 0 ? (
              <p className="empty-state">No news available.</p>
            ) : (
              <div className="news-list" style={{ marginTop: '1rem' }}>
                {news.map((article, i) => (
                  <div key={i} className="news-card">
                    {article.image && (
                      <img src={article.image} alt={article.headline} className="news-card__image" />
                    )}
                    <div className="news-card__body">
                      <strong className="news-card__headline">{article.headline}</strong>
                      {article.description && <p className="news-card__desc">{article.description}</p>}
                      <span className="news-card__date">
                        {new Date(article.published).toLocaleDateString()}
                      </span>
                      {article.link && (
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="news-card__link"
                        >
                          Read more →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </section>
  )
}
