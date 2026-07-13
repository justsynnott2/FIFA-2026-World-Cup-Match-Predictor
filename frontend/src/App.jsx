import './App.css'
import { NavLink, Routes, Route } from 'react-router-dom'
import Overview from './pages/Overview'
import Fixtures from './pages/Fixtures'
import GroupStage from './pages/GroupStage'
import TournamentBracket from './pages/TournamentBracket'
import CustomMatch from './pages/CustomMatch'
import TeamPage from './pages/TeamPage'

// App shell: top bar with nav plus the route table for every page. No routing
// logic beyond react-router's Routes/Route lives here. Default export: App.

// Single source for both the rendered nav links and (implicitly) the routes
// below — each entry's `to` must match a <Route path> for the nav to work.
const navLinks = [
  { label: 'Overview',           to: '/',        end: true },
  { label: 'Fixtures',           to: '/fixtures'           },
  { label: 'Group Stage',        to: '/groups'             },
  { label: 'Tournament Bracket', to: '/bracket'            },
  { label: 'Custom Match',       to: '/custom'             },
]

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span>WC26</span><strong>Match Predictor</strong></div>
        <nav aria-label="Primary navigation">
          {navLinks.map(({ label, to, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/"         element={<Overview />} />
        <Route path="/fixtures" element={<Fixtures />} />
        <Route path="/groups"   element={<GroupStage />} />
        <Route path="/bracket"  element={<TournamentBracket />} />
        <Route path="/custom"        element={<CustomMatch />} />
        <Route path="/team/:espnId"  element={<TeamPage />} />
      </Routes>
    </main>
  )
}

export default App
