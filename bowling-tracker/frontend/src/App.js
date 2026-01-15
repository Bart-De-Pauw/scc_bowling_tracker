// ============================================================================
// BOWLING TRACKER - REACT FRONTEND
// This is the main App.js file. Build structure with React Router
// ============================================================================

import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      setCurrentPage('dashboard');
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setCurrentPage('login');
  };

  if (!token) {
    return <LoginPage setToken={setToken} setCurrentUser={setCurrentUser} />;
  }

  return (
    <div className="app">
      <Navigation 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      
      <div className="main-content">
        {currentPage === 'dashboard' && <Dashboard token={token} />}
        {currentPage === 'players' && <PlayersPage token={token} />}
        {currentPage === 'evenings' && <EveningsPage token={token} />}
        {currentPage === 'leaderboards' && <LeaderboardsPage token={token} />}
        {currentPage === 'scoring' && <ScoringPage token={token} />}
        {currentPage === 'admin' && <AdminPage token={token} />}
      </div>
    </div>
  );
}

// ============================================================================
// NAVIGATION COMPONENT
// ============================================================================

function Navigation({ currentPage, setCurrentPage, onLogout, currentUser }) {
  return (
    <nav className="navigation">
      <div className="nav-brand">🎳 Bowling Tracker</div>
      <div className="nav-links">
        <button 
          className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentPage('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`nav-link ${currentPage === 'players' ? 'active' : ''}`}
          onClick={() => setCurrentPage('players')}
        >
          Players
        </button>
        <button 
          className={`nav-link ${currentPage === 'evenings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('evenings')}
        >
          Evenings
        </button>
        <button 
          className={`nav-link ${currentPage === 'scoring' ? 'active' : ''}`}
          onClick={() => setCurrentPage('scoring')}
        >
          Scoring
        </button>
        <button 
          className={`nav-link ${currentPage === 'leaderboards' ? 'active' : ''}`}
          onClick={() => setCurrentPage('leaderboards')}
        >
          Leaderboards
        </button>
        <button 
          className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
          onClick={() => setCurrentPage('admin')}
        >
          Admin
        </button>
        <button className="nav-link logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

// ============================================================================
// LOGIN PAGE
// ============================================================================

function LoginPage({ setToken, setCurrentUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setCurrentUser(data.player);
    } catch (err) {
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🎳 Bowling League Tracker</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="login-help">
          Contact admin to register for the league
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

function Dashboard({ token }) {
  const [topPlayers, setTopPlayers] = useState([]);
  const [topTeams, setTopTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const playerRes = await fetch(`${API_URL}/api/leaderboards/individual`, { headers });
      const teamRes = await fetch(`${API_URL}/api/leaderboards/team`, { headers });

      setTopPlayers(await playerRes.json());
      setTopTeams(await teamRes.json());
    } catch (err) {
      console.error('Error fetching leaderboards:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>🏆 Top Players</h2>
          {topPlayers.slice(0, 5).map((player, i) => (
            <div key={player.id} className="leaderboard-item">
              <span className={`medal medal-${i + 1}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span className="player-name">
                {player.firstName} {player.lastName}
              </span>
              <span className="player-score">{player.totalPoints || 0}</span>
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <h2>👥 Top Teams</h2>
          {topTeams.slice(0, 5).map((team, i) => (
            <div key={team.id} className="leaderboard-item">
              <span className={`medal medal-${i + 1}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span className="team-name">{team.name}</span>
              <span className="team-score">{team.totalPoints || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PLAYERS PAGE
// ============================================================================

function PlayersPage({ token }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/players`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setPlayers(await response.json());
    } catch (err) {
      console.error('Error fetching players:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="players-page">
      <h1>Players</h1>
      <div className="players-grid">
        {players.map(player => (
          <div key={player.id} className="player-card">
            <div className="player-header">
              <h3>{player.firstName} {player.lastName}</h3>
              <span className={`badge status-${player.status}`}>
                {player.status}
              </span>
            </div>
            <div className="player-details">
              <p><strong>Email:</strong> {player.email}</p>
              <p><strong>Handicap:</strong> {player.handicap}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EVENINGS PAGE
// ============================================================================

function EveningsPage({ token }) {
  const [evenings, setEvenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvening, setSelectedEvening] = useState(null);

  useEffect(() => {
    fetchEvenings();
  }, []);

  const fetchEvenings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/evenings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setEvenings(await response.json());
    } catch (err) {
      console.error('Error fetching evenings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="evenings-page">
      <h1>Evenings</h1>
      <div className="evenings-list">
        {evenings.map(evening => (
          <div key={evening.id} className="evening-card">
            <div className="evening-header">
              <h3>Evening {evening.eveningNumber}</h3>
              <span className={`badge status-${evening.status}`}>
                {evening.status}
              </span>
            </div>
            <p><strong>Date:</strong> {new Date(evening.playingDate).toLocaleDateString()}</p>
            <button 
              className="btn-secondary"
              onClick={() => setSelectedEvening(evening.id)}
            >
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SCORING PAGE
// ============================================================================

function ScoringPage({ token }) {
  const [evenings, setEvenings] = useState([]);
  const [selectedEvening, setSelectedEvening] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEvenings();
  }, []);

  useEffect(() => {
    if (selectedEvening) {
      fetchScores(selectedEvening);
    }
  }, [selectedEvening]);

  const fetchEvenings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/evenings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setEvenings(await response.json());
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchScores = async (eveningId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/evenings/${eveningId}/scores`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setScores(await response.json());
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = async (playerId, gameNumber, score) => {
    try {
      await fetch(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          eveningId: selectedEvening,
          gameNumber,
          score: parseInt(score),
        }),
      });
      fetchScores(selectedEvening);
    } catch (err) {
      console.error('Error saving score:', err);
    }
  };

  return (
    <div className="scoring-page">
      <h1>Score Entry</h1>
      
      <div className="form-group">
        <label>Select Evening:</label>
        <select 
          value={selectedEvening || ''} 
          onChange={(e) => setSelectedEvening(parseInt(e.target.value))}
        >
          <option value="">-- Choose an evening --</option>
          {evenings.map(e => (
            <option key={e.id} value={e.id}>
              Evening {e.eveningNumber} - {new Date(e.playingDate).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedEvening && (
        <div className="scores-table">
          <h3>Score Entry</h3>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Game 1</th>
                <th>Game 2</th>
                <th>Game 3</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map(score => (
                  <tr key={`${score.playerId}-${score.gameNumber}`}>
                    <td>{score.firstName} {score.lastName}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        defaultValue={score.gameNumber === 1 ? score.score : ''}
                        onChange={(e) => handleScoreChange(score.playerId, 1, e.target.value)}
                        placeholder="Score"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        defaultValue={score.gameNumber === 2 ? score.score : ''}
                        onChange={(e) => handleScoreChange(score.playerId, 2, e.target.value)}
                        placeholder="Score"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        defaultValue={score.gameNumber === 3 ? score.score : ''}
                        onChange={(e) => handleScoreChange(score.playerId, 3, e.target.value)}
                        placeholder="Score"
                      />
                    </td>
                    <td>-</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5">No players for this evening</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LEADERBOARDS PAGE
// ============================================================================

function LeaderboardsPage({ token }) {
  const [leaderboards, setLeaderboards] = useState({ individual: [], team: [] });
  const [view, setView] = useState('individual');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const indRes = await fetch(`${API_URL}/api/leaderboards/individual`, { headers });
      const teamRes = await fetch(`${API_URL}/api/leaderboards/team`, { headers });

      setLeaderboards({
        individual: await indRes.json(),
        team: await teamRes.json(),
      });
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const data = view === 'individual' ? leaderboards.individual : leaderboards.team;

  return (
    <div className="leaderboards-page">
      <h1>Leaderboards</h1>
      
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${view === 'individual' ? 'active' : ''}`}
          onClick={() => setView('individual')}
        >
          Individual
        </button>
        <button 
          className={`toggle-btn ${view === 'team' ? 'active' : ''}`}
          onClick={() => setView('team')}
        >
          Team
        </button>
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>{view === 'individual' ? 'Player' : 'Team'}</th>
            <th>Total Points</th>
            <th>Average</th>
            <th>High Score</th>
            {view === 'individual' && <th>Handicap</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.id} className={idx < 3 ? `medal-${idx + 1}` : ''}>
              <td className="rank">{idx + 1}</td>
              <td>
                {view === 'individual' 
                  ? `${item.firstName} ${item.lastName}` 
                  : item.name
                }
              </td>
              <td className="score-cell">{item.totalPoints || 0}</td>
              <td>{(item.averageScore || 0).toFixed(1)}</td>
              <td>{item.highScore || 0}</td>
              {view === 'individual' && <td>{item.handicap || 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ADMIN PAGE
// ============================================================================

function AdminPage({ token }) {
  const [activeTab, setActiveTab] = useState('register-player');
  const [formData, setFormData] = useState({ email: '', firstName: '', lastName: '' });
  const [message, setMessage] = useState('');

  const handleRegisterPlayer = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/players/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('✓ Invite sent to ' + formData.email);
        setFormData({ email: '', firstName: '', lastName: '' });
      } else {
        setMessage('✗ Error registering player');
      }
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  return (
    <div className="admin-page">
      <h1>Admin Panel</h1>
      
      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'register-player' ? 'active' : ''}`}
          onClick={() => setActiveTab('register-player')}
        >
          Register Player
        </button>
        <button 
          className={`tab-btn ${activeTab === 'create-evening' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-evening')}
        >
          Create Evening
        </button>
      </div>

      {activeTab === 'register-player' && (
        <div className="admin-form">
          <h2>Register New Player</h2>
          <form onSubmit={handleRegisterPlayer}>
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <button type="submit" className="btn-primary">Send Invite</button>
          </form>
          {message && <div className="message">{message}</div>}
        </div>
      )}
    </div>
  );
}

export default App;
