import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAllFixtures, getTeamSquad, getTeamNews, predictMatch } from '../utils/api'
import SegmentedProbabilityBar from '../components/SegmentedProbabilityBar'
import { allTeams } from '../data/tournament'
import { isMatchLive, isMatchCompleted, STATUS_DELAYED } from '../utils/matchStatus'

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
  const isUpcoming = !completed && !live
  const isPredictable = !!fixture.home_logo && !!fixture.away_logo
  const homeIsSelf = fixture.home_espn_id === currentEspnId
  const awayIsSelf = fixture.away_espn_id === currentEspnId
  const [isFlipped, setIsFlipped] = useState(false)
  const [prediction, setPrediction] = useState(undefined)

  function handleFlip() {
    if (!isFlipped && prediction === undefined) {
      setPrediction('loading')
      predictMatch(fixture.home_team, fixture.away_team)
        .then(result => setPrediction(result))
        .catch(() => setPrediction('error'))
    }
    setIsFlipped(true)
  }

  const ROUND_LABELS = {
    'round-of-32':     'Round of 32',
    'round-of-16':     'Round of 16',
    'quarterfinals':   'Quarterfinals',
    'semifinals':      'Semifinals',
    'final':           'Final',
    '3rd-place-match': '3rd Place',
  }
  const roundLabel = ROUND_LABELS[fixture.round] ?? (fixture.group ? 'Group ' + fixture.group : null)

  const metaMarkup = (
    <div className="fixture-card__meta">
      <span>{formatMatchDate(fixture.date)}</span>
      <span>{fixture.venue}, {fixture.city}</span>
      {roundLabel && <span>{roundLabel}</span>}
    </div>
  )

  const teamsMarkup = (
    <div className="fixture-card__teams">
      <div className="fixture-card__team">
        {fixture.home_logo && <img src={fixture.home_logo} alt={fixture.home_team} className="fixture-card__logo" />}
        <span
          className={`fixture-card__name${(!homeIsSelf && fixture.home_logo) ? ' team-name-link' : ''}`}
          style={!fixture.home_logo ? { color: 'var(--muted)' } : undefined}
          onClick={(!homeIsSelf && fixture.home_logo) ? (e) => { e.stopPropagation(); navigate(`/team/${fixture.home_espn_id}`) } : undefined}
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
                <span className={fixture.status === STATUS_DELAYED ? 'delay-badge' : 'live-badge'}>
                  {fixture.status === STATUS_DELAYED ? 'DELAY' : 'LIVE'}
                </span>
              </div>
            )
            : <span className="fixture-card__vs">vs</span>
        }
      </div>
      <div className="fixture-card__team fixture-card__team--away">
        <span
          className={`fixture-card__name${(!awayIsSelf && fixture.away_logo) ? ' team-name-link' : ''}`}
          style={!fixture.away_logo ? { color: 'var(--muted)' } : undefined}
          onClick={(!awayIsSelf && fixture.away_logo) ? (e) => { e.stopPropagation(); navigate(`/team/${fixture.away_espn_id}`) } : undefined}
        >
          {fixture.away_team}
        </span>
        {fixture.away_logo && <img src={fixture.away_logo} alt={fixture.away_team} className="fixture-card__logo" />}
      </div>
    </div>
  )

  if (!isUpcoming || !isPredictable) {
    return (
      <article className="fixture-card">
        {metaMarkup}
        {teamsMarkup}
      </article>
    )
  }

  return (
    <div className={`fixture-card-wrapper${isFlipped ? ' fixture-card-flipped' : ''}`}>
      <div className="fixture-card-flipper">

        {/* Front face */}
        <article className="fixture-card fixture-card__front" onClick={handleFlip}>
          {metaMarkup}
          {teamsMarkup}
        </article>

        {/* Back face */}
        <div className="fixture-card fixture-card__back" onClick={() => setIsFlipped(false)}>
          {prediction === 'loading' && <p className="predict-loading">Fetching…</p>}
          {prediction && prediction !== 'loading' && prediction !== 'error' && (
            <SegmentedProbabilityBar
              prediction={prediction}
              home={{ name: fixture.home_team, code: fixture.home_code }}
              away={{ name: fixture.away_team, code: fixture.away_code }}
            />
          )}
          {prediction === 'error' && <p className="predict-loading">Prediction unavailable</p>}
        </div>

      </div>
    </div>
  )
}

export default function TeamPage() {
  const { espnId } = useParams()

  const [allFixtures, setAllFixtures] = useState(null)
  const [squad, setSquad] = useState(null)
  const [news, setNews] = useState(null)
  const [newsPage, setNewsPage] = useState(0)

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

  useEffect(() => {
    setNewsPage(0)
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
            <h2>Fixtures</h2>
            <div className="fixture-list" style={{ marginTop: '1rem' }}>
              {teamFixtures.map((f) => (
                <TeamFixtureCard key={f.fixture_id} fixture={f} currentEspnId={espnId} />
              ))}
            </div>
          </div>

          {/* News */}
          <div>
            <h2>Recent News</h2>
            {!news ? (
              <p className="empty-state">Loading news…</p>
            ) : news.length === 0 ? (
              <p className="empty-state">No news available.</p>
            ) : (
              <>
                <div className="news-list" style={{ marginTop: '1rem' }}>
                  {news.slice(newsPage * 5, (newsPage + 1) * 5).map((article, i) => (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    className="secondary-button"
                    onClick={() => setNewsPage(p => p - 1)}
                    disabled={newsPage === 0}
                  >
                    ← Prev
                  </button>
                  <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                    Page {newsPage + 1} of {Math.ceil(news.length / 5)}
                  </span>
                  <button
                    className="secondary-button"
                    onClick={() => setNewsPage(p => p + 1)}
                    disabled={(newsPage + 1) * 5 >= news.length}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

    </section>
  )
}
