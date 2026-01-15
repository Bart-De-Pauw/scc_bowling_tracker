// ============================================================================
// BOWLING TRACKER - DATABASE SETUP & INITIALIZATION
// File: backend/database.js
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

// Create/open database file
const dbPath = process.env.DB_PATH || path.join(__dirname, 'bowling.db');
console.log(`📊 Using database: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys for referential integrity
db.pragma('foreign_keys = ON');

// ============================================================================
// TABLE CREATION
// ============================================================================

console.log('🔧 Initializing database schema...');

db.exec(`
  -- ========================================================================
  -- PLAYERS TABLE
  -- ========================================================================
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    password TEXT,
    role TEXT DEFAULT 'player' CHECK(role IN ('admin', 'player')),
    status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'active', 'inactive')),
    handicap INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
  CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

  -- ========================================================================
  -- EVENINGS TABLE (Bowling nights)
  -- ========================================================================
  CREATE TABLE IF NOT EXISTS evenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eveningNumber INTEGER NOT NULL UNIQUE,
    playingDate DATE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in-progress', 'completed')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_evenings_number ON evenings(eveningNumber);
  CREATE INDEX IF NOT EXISTS idx_evenings_date ON evenings(playingDate);

  -- ========================================================================
  -- TEAMS TABLE (Teams for a specific evening)
  -- ========================================================================
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eveningId INTEGER NOT NULL,
    name TEXT NOT NULL,
    captainId INTEGER,
    isGhost INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (eveningId) REFERENCES evenings(id) ON DELETE CASCADE,
    FOREIGN KEY (captainId) REFERENCES players(id) ON DELETE SET NULL,
    UNIQUE(eveningId, name)
  );

  CREATE INDEX IF NOT EXISTS idx_teams_eveningId ON teams(eveningId);
  CREATE INDEX IF NOT EXISTS idx_teams_captainId ON teams(captainId);

  -- ========================================================================
  -- TEAM PLAYERS (Which players are on which team for each evening)
  -- ========================================================================
  CREATE TABLE IF NOT EXISTS teamPlayers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    playerId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(teamId, playerId)
  );

  CREATE INDEX IF NOT EXISTS idx_teamPlayers_teamId ON teamPlayers(teamId);
  CREATE INDEX IF NOT EXISTS idx_teamPlayers_playerId ON teamPlayers(playerId);

  -- ========================================================================
  -- SCORES TABLE
  -- ========================================================================
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerId INTEGER NOT NULL,
    eveningId INTEGER NOT NULL,
    gameNumber INTEGER NOT NULL CHECK(gameNumber IN (1, 2, 3)),
    score INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (eveningId) REFERENCES evenings(id) ON DELETE CASCADE,
    UNIQUE(playerId, eveningId, gameNumber)
  );

  CREATE INDEX IF NOT EXISTS idx_scores_playerId ON scores(playerId);
  CREATE INDEX IF NOT EXISTS idx_scores_eveningId ON scores(eveningId);
  CREATE INDEX IF NOT EXISTS idx_scores_composite ON scores(playerId, eveningId);
`);

console.log('✓ Database schema initialized');

// ============================================================================
// SEED ADMIN USER (Only if it doesn't exist)
// ============================================================================

function seedAdminUser() {
  try {
    const existingAdmin = db.prepare('SELECT id FROM players WHERE email = ?').get('admin@bowling.local');
    
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      db.prepare(`
        INSERT INTO players (email, firstName, lastName, password, role, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('admin@bowling.local', 'Admin', 'User', hashedPassword, 'admin', 'active');
      
      console.log('\n🔐 Admin user created');
      console.log('   Email: admin@bowling.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY in production!\n');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
  }
}

seedAdminUser();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate handicap for a player
 * Formula: max(0, (200 - season_moving_average) × 0.7)
 * Based on average of last 10 evenings (each evening = 3 games)
 */
function calculateHandicap(playerId) {
  try {
    // Get the average score for each evening
    const eveningAverages = db.prepare(`
      SELECT 
        eveningId,
        AVG(score) as avgScore
      FROM scores
      WHERE playerId = ?
      GROUP BY eveningId
      ORDER BY eveningId DESC
      LIMIT 10
    `).all(playerId);

    if (eveningAverages.length >= 3) {
      // Calculate moving average
      const totalAvg = eveningAverages.reduce((sum, e) => sum + e.avgScore, 0);
      const movingAverage = totalAvg / eveningAverages.length;
      
      // Apply handicap formula
      const handicap = Math.max(0, Math.round((200 - movingAverage) * 0.7));
      
      // Update player handicap
      db.prepare('UPDATE players SET handicap = ? WHERE id = ?').run(handicap, playerId);
      
      return handicap;
    }
  } catch (error) {
    console.error('Error calculating handicap:', error.message);
  }
  return 0;
}

/**
 * Get player statistics
 */
function getPlayerStats(playerId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as gamesPlayed,
      SUM(score) as totalPoints,
      AVG(score) as averageScore,
      MAX(score) as highScore,
      MIN(score) as lowScore,
      ROUND(AVG(score), 2) as movingAverage
    FROM scores
    WHERE playerId = ?
  `).get(playerId);

  const player = db.prepare('SELECT handicap FROM players WHERE id = ?').get(playerId);

  return {
    ...stats,
    handicap: player?.handicap || 0
  };
}

/**
 * Get team statistics for a specific evening
 */
function getTeamStats(teamId, eveningId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT tp.playerId) as playerCount,
      SUM(s.score) as totalPoints,
      ROUND(AVG(s.score), 2) as averageScore,
      MAX(s.score) as highScore
    FROM teamPlayers tp
    LEFT JOIN scores s ON tp.playerId = s.playerId AND s.eveningId = ?
    WHERE tp.teamId = ?
  `).get(eveningId, teamId);

  return stats;
}

/**
 * Get leaderboard with rankings
 */
function getIndividualLeaderboard() {
  return db.prepare(`
    SELECT 
      p.id,
      p.firstName,
      p.lastName,
      p.handicap,
      p.email,
      COUNT(s.id) as gamesPlayed,
      SUM(s.score) as totalPoints,
      ROUND(AVG(s.score), 2) as averageScore,
      MAX(s.score) as highScore,
      ROUND(AVG(s.score), 2) as movingAverage
    FROM players p
    LEFT JOIN scores s ON p.id = s.playerId
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY totalPoints DESC
  `).all();
}

/**
 * Get team leaderboard
 */
function getTeamLeaderboard() {
  return db.prepare(`
    SELECT 
      t.id,
      t.name,
      t.eveningId,
      t.captainId,
      t.isGhost,
      SUM(s.score) as totalPoints,
      ROUND(AVG(s.score), 2) as averageScore,
      COUNT(DISTINCT tp.playerId) as playerCount,
      MAX(s.score) as highScore
    FROM teams t
    LEFT JOIN teamPlayers tp ON t.id = tp.teamId
    LEFT JOIN scores s ON tp.playerId = s.playerId AND t.eveningId = s.eveningId
    GROUP BY t.id
    ORDER BY totalPoints DESC
  `).all();
}

/**
 * Create a new score or update existing
 */
function upsertScore(playerId, eveningId, gameNumber, score) {
  const existingScore = db.prepare(`
    SELECT id FROM scores
    WHERE playerId = ? AND eveningId = ? AND gameNumber = ?
  `).get(playerId, eveningId, gameNumber);

  if (existingScore) {
    db.prepare(`
      UPDATE scores 
      SET score = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(score, existingScore.id);
  } else {
    db.prepare(`
      INSERT INTO scores (playerId, eveningId, gameNumber, score)
      VALUES (?, ?, ?, ?)
    `).run(playerId, eveningId, gameNumber, score);
  }

  // Recalculate handicap after score update
  calculateHandicap(playerId);
}

/**
 * Get all scores for an evening
 */
function getEveningScores(eveningId) {
  return db.prepare(`
    SELECT 
      s.id,
      s.playerId,
      s.eveningId,
      s.gameNumber,
      s.score,
      p.firstName,
      p.lastName,
      p.email,
      p.handicap
    FROM scores s
    JOIN players p ON s.playerId = p.id
    WHERE s.eveningId = ?
    ORDER BY p.firstName, p.lastName, s.gameNumber
  `).all(eveningId);
}

/**
 * Get player scores for a specific evening
 */
function getPlayerEveningScores(playerId, eveningId) {
  return db.prepare(`
    SELECT 
      gameNumber,
      score
    FROM scores
    WHERE playerId = ? AND eveningId = ?
    ORDER BY gameNumber
  `).all(playerId, eveningId);
}

// ============================================================================
// EXPORT DATABASE AND HELPER FUNCTIONS
// ============================================================================

module.exports = {
  db,
  calculateHandicap,
  getPlayerStats,
  getTeamStats,
  getIndividualLeaderboard,
  getTeamLeaderboard,
  upsertScore,
  getEveningScores,
  getPlayerEveningScores
};
