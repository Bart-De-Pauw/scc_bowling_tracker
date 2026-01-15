// ============================================================================
// BOWLING COMPETITION TRACKER - FULL STACK APPLICATION
// ============================================================================
// This is a complete guide with code snippets for deploying on Raspberry Pi
// 
// PROJECT STRUCTURE:
// bowling-tracker/
// ├── frontend/
// │   ├── src/
// │   ├── package.json
// │   └── Dockerfile
// ├── backend/
// │   ├── server.js
// │   ├── database.js
// │   ├── routes/
// │   ├── package.json
// │   └── Dockerfile
// ├── docker-compose.yml
// └── README.md

// ============================================================================
// STEP 1: BACKEND - server.js
// ============================================================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Email configuration (update with your settings)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ============================================================================
// PLAYER ROUTES
// ============================================================================

// Admin: Register new player (sends invite)
app.post('/api/players/register', authenticateToken, (req, res) => {
  const { email, firstName, lastName } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const player = db.prepare(`
    INSERT INTO players (email, firstName, lastName, role, status)
    VALUES (?, ?, ?, 'player', 'invited')
  `).run(email, firstName, lastName);
  
  const inviteToken = jwt.sign({ playerId: player.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite/${inviteToken}`;
  
  // Send invite email
  emailTransporter.sendMail({
    to: email,
    subject: 'Bowling League Registration Invite',
    html: `Click here to complete registration: <a href="${inviteUrl}">${inviteUrl}</a>`,
  });
  
  res.json({ playerId: player.lastID, message: 'Invite sent' });
});

// Player: Accept invite and set password
app.post('/api/players/accept-invite', (req, res) => {
  const { token, password } = req.body;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.prepare(`
      UPDATE players 
      SET password = ?, status = 'active'
      WHERE id = ?
    `).run(hashedPassword, decoded.playerId);
    
    res.json({ message: 'Registration complete' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired invite' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const player = db.prepare('SELECT * FROM players WHERE email = ?').get(email);
  
  if (!player) return res.status(401).json({ error: 'Invalid credentials' });
  
  const validPassword = bcrypt.compareSync(password, player.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign(
    { playerId: player.id, email: player.email, role: player.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  res.json({ token, player: { id: player.id, email: player.email, firstName: player.firstName } });
});

// Get all players
app.get('/api/players', authenticateToken, (req, res) => {
  const players = db.prepare(`
    SELECT id, email, firstName, lastName, handicap, status
    FROM players
    ORDER BY firstName
  `).all();
  
  res.json(players);
});

// Get player stats
app.get('/api/players/:id/stats', authenticateToken, (req, res) => {
  const playerId = req.params.id;
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as gamesPlayed,
      SUM(score) as totalPoints,
      AVG(score) as averageScore,
      MAX(score) as highScore,
      ROUND(AVG(score), 2) as movingAverage
    FROM scores
    WHERE playerId = ?
  `).get(playerId);
  
  const player = db.prepare('SELECT handicap FROM players WHERE id = ?').get(playerId);
  
  res.json({ ...stats, handicap: player?.handicap || 0 });
});

// ============================================================================
// EVENING ROUTES
// ============================================================================

// Admin: Create evening
app.post('/api/evenings', authenticateToken, (req, res) => {
  const { eveningNumber, playingDate } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const evening = db.prepare(`
    INSERT INTO evenings (eveningNumber, playingDate, status)
    VALUES (?, ?, 'scheduled')
  `).run(eveningNumber, playingDate);
  
  res.json({ id: evening.lastID, eveningNumber, playingDate });
});

// Get all evenings
app.get('/api/evenings', authenticateToken, (req, res) => {
  const evenings = db.prepare(`
    SELECT * FROM evenings
    ORDER BY playingDate
  `).all();
  
  res.json(evenings);
});

// Get evening with teams
app.get('/api/evenings/:id', authenticateToken, (req, res) => {
  const evening = db.prepare('SELECT * FROM evenings WHERE id = ?').get(req.params.id);
  
  const teams = db.prepare(`
    SELECT t.id, t.name, t.eveningId, t.captainId, t.isGhost,
           GROUP_CONCAT(tp.playerId) as playerIds
    FROM teams t
    LEFT JOIN teamPlayers tp ON t.id = tp.teamId
    WHERE t.eveningId = ?
    GROUP BY t.id
  `).all(req.params.id);
  
  res.json({ ...evening, teams });
});

// ============================================================================
// TEAM ROUTES
// ============================================================================

// Admin: Create team
app.post('/api/teams', authenticateToken, (req, res) => {
  const { eveningId, name, captainId, playerIds, isGhost } = req.body;
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const team = db.prepare(`
    INSERT INTO teams (eveningId, name, captainId, isGhost)
    VALUES (?, ?, ?, ?)
  `).run(eveningId, name, captainId || null, isGhost ? 1 : 0);
  
  // Add players to team
  playerIds?.forEach(playerId => {
    db.prepare(`
      INSERT INTO teamPlayers (teamId, playerId)
      VALUES (?, ?)
    `).run(team.lastID, playerId);
  });
  
  res.json({ id: team.lastID, name, captainId, playerIds });
});

// Update team (add/remove players)
app.put('/api/teams/:id', authenticateToken, (req, res) => {
  const { playerIds } = req.body;
  
  db.prepare('DELETE FROM teamPlayers WHERE teamId = ?').run(req.params.id);
  
  playerIds?.forEach(playerId => {
    db.prepare(`
      INSERT INTO teamPlayers (teamId, playerId)
      VALUES (?, ?)
    `).run(req.params.id, playerId);
  });
  
  res.json({ message: 'Team updated' });
});

// ============================================================================
// SCORE ROUTES
// ============================================================================

// Submit score (player or team captain)
app.post('/api/scores', authenticateToken, (req, res) => {
  const { playerId, eveningId, gameNumber, score } = req.body;
  
  // Check if user is the player or team captain
  const team = db.prepare(`
    SELECT t.captainId FROM teams t
    JOIN teamPlayers tp ON t.id = tp.teamId
    WHERE tp.playerId = ? AND t.eveningId = ?
  `).get(playerId, eveningId);
  
  if (req.user.playerId !== playerId && req.user.playerId !== team?.captainId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const existingScore = db.prepare(`
    SELECT id FROM scores
    WHERE playerId = ? AND eveningId = ? AND gameNumber = ?
  `).get(playerId, eveningId, gameNumber);
  
  if (existingScore) {
    db.prepare(`
      UPDATE scores SET score = ? WHERE id = ?
    `).run(score, existingScore.id);
  } else {
    db.prepare(`
      INSERT INTO scores (playerId, eveningId, gameNumber, score)
      VALUES (?, ?, ?, ?)
    `).run(playerId, eveningId, gameNumber, score);
  }
  
  // Calculate handicap if needed
  calculateHandicap(playerId);
  
  res.json({ message: 'Score saved' });
});

// Get scores for evening
app.get('/api/evenings/:eveningId/scores', authenticateToken, (req, res) => {
  const scores = db.prepare(`
    SELECT s.id, s.playerId, s.gameNumber, s.score, 
           p.firstName, p.lastName, p.handicap
    FROM scores s
    JOIN players p ON s.playerId = p.id
    WHERE s.eveningId = ?
    ORDER BY p.firstName, s.gameNumber
  `).all(req.params.eveningId);
  
  res.json(scores);
});

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

// Individual leaderboard
app.get('/api/leaderboards/individual', authenticateToken, (req, res) => {
  const leaderboard = db.prepare(`
    SELECT 
      p.id,
      p.firstName,
      p.lastName,
      p.handicap,
      COUNT(s.id) as gamesPlayed,
      SUM(s.score) as totalPoints,
      ROUND(AVG(s.score), 2) as averageScore,
      MAX(s.score) as highScore
    FROM players p
    LEFT JOIN scores s ON p.id = s.playerId
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY totalPoints DESC
  `).all();
  
  res.json(leaderboard);
});

// Team leaderboard
app.get('/api/leaderboards/team', authenticateToken, (req, res) => {
  const leaderboard = db.prepare(`
    SELECT 
      t.id,
      t.name,
      t.eveningId,
      SUM(s.score) as totalPoints,
      ROUND(AVG(s.score), 2) as averageScore,
      COUNT(DISTINCT tp.playerId) as playerCount
    FROM teams t
    LEFT JOIN teamPlayers tp ON t.id = tp.teamId
    LEFT JOIN scores s ON tp.playerId = s.playerId AND t.eveningId = s.eveningId
    GROUP BY t.id
    ORDER BY totalPoints DESC
  `).all();
  
  res.json(leaderboard);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateHandicap(playerId) {
  const scores = db.prepare(`
    SELECT s.eveningId, AVG(s.score * 3) as eveningTotal
    FROM scores s
    WHERE s.playerId = ?
    GROUP BY s.eveningId
    ORDER BY s.eveningId DESC
    LIMIT 10
  `).all(playerId);
  
  if (scores.length >= 3) {
    const movingAverage = scores.reduce((sum, s) => sum + s.eveningTotal, 0) / scores.length;
    const handicap = Math.max(0, Math.round((200 - movingAverage) * 0.7));
    
    db.prepare('UPDATE players SET handicap = ? WHERE id = ?').run(handicap, playerId);
  }
}

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
