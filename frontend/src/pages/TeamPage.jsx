import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getAllFixtures, getTeamSquad, getTeamNews } from '../utils/api'
import FixtureCard from '../components/FixtureCard'
import { allTeams } from '../data/tournament'

// Per-team page (squad, fixtures, news), keyed by ESPN team ID from the route
// param. There's no dedicated "team" endpoint, so team identity (name, code,
// logo, confederation) is derived by finding any fixture involving this ESPN
// ID and reading that team's own fields off it — see identityFixture below.
// Default export: TeamPage.

const SQUAD_SECTIONS = [
  { key: 'GK',  label: 'Goalkeepers' },
  { key: 'DEF', label: 'Defenders'   },
  { key: 'MID', label: 'Midfielders' },
  { key: 'FWD', label: 'Forwards'    },
]

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

  // Any fixture involving this team works as an "identity" source — there's no
  // team-lookup endpoint, so name/code/logo are just read off whichever side
  // of this fixture matches the route's ESPN ID.
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
                <FixtureCard key={f.fixture_id} fixture={f} currentEspnId={espnId} />
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
