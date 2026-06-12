import { useState } from 'react'
import './App.css'
import Overview from './pages/Overview'
import Fixtures from './pages/Fixtures'
import GroupStage from './pages/GroupStage'
import TournamentBracket from './pages/TournamentBracket'
import CustomMatch from './pages/CustomMatch'

const tabs = ['Overview', 'Fixtures', 'Group Stage', 'Tournament Bracket', 'Custom Match']

function App() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span>WC26</span>
          <strong>Match Predictor</strong>
        </div>
        <nav aria-label="Primary navigation">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab ? 'active' : ''}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'Overview' && <Overview onNavigate={setActiveTab} />}
      {activeTab === 'Fixtures' && <Fixtures />}
      {activeTab === 'Group Stage' && <GroupStage />}
      {activeTab === 'Tournament Bracket' && <TournamentBracket />}
      {activeTab === 'Custom Match' && <CustomMatch />}
    </main>
  )
}

export default App
