import './App.css'
import { NavLink, Routes, Route } from 'react-router-dom'
import Overview from './pages/Overview'
import Fixtures from './pages/Fixtures'
import GroupStage from './pages/GroupStage'
import TournamentBracket from './pages/TournamentBracket'
import CustomMatch from './pages/CustomMatch'

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
        <Route path="/custom"   element={<CustomMatch />} />
      </Routes>
    </main>
  )
}

export default App
