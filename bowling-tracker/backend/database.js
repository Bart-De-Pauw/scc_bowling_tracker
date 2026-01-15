// ============================================================================
// BOWLING TRACKER - DATABASE SETUP (database.js)
// ============================================================================

const Database = require('better-sqlite3');
const path = require('path');

// Create/open database
const dbPath = process.env.DB_PATH || path.join(__dirname, 'bowling.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ============================================================================
// CREATE TABLES
// ============================================================================

db.exec(`
  -- Players table
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

  -- Evenings table (bowling nights)
  CREATE TABLE IF NOT EXISTS evenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eveningNumber INTEGER NOT NULL UNIQUE,
    playingDate DATE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in-progress', 'completed')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Teams table (teams for a specific evening)
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eveningId INTEGER NOT NULL,
    name TEXT NOT NULL,
    captainId INTEGER,
    isGhost INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (eveningId) REFERENCES evenings(id) ON DELETE CASCADE,
    FOREIGN KEY (captainId) REFERENCES players(id) ON DELETE SET NULL,
    UNIQUE(eveningId, name)
  );

  -- Team Players (which players are on which team for each evening)
  CREATE TABLE IF NOT EXISTS teamPlayers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teamId INTEGER NOT NULL,
    playerId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(teamId, playerId)
  );

  -- Scores table
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerId INTEGER NOT NULL,
    eveningId INTEGER NOT NULL,
    gameNumber INTEGER NOT NULL CHECK(gameNumber IN (1, 2, 3)),
    score INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (eveningId) REFERENCES evenings(id) ON DELETE CASCADE,
    UNIQUE(playerId, eveningId, gameNumber)
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_scores_playerId ON scores(playerId);
  CREATE INDEX IF NOT EXISTS idx_scores_eveningId ON scores(eveningId);
  CREATE INDEX IF NOT EXISTS idx_teamPlayers_teamId ON teamPlayers(teamId);
  CREATE INDEX IF NOT EXISTS idx_teamPlayers_playerId ON teamPlayers(playerId);
  CREATE INDEX IF NOT EXISTS idx_teams_eveningId ON teams(eveningId);
  CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
`);

module.exports = db;

// ============================================================================
// HELPER FUNCTIONS FOR DATABASE OPERATIONS
// ============================================================================

// Insert default admin user
function seedAdminUser() {
  const bcrypt = require('bcrypt');
  const adminEmail = 'admin@bowling.local';
  
  try {
    const existingAdmin = db.prepare('SELECT id FROM players WHERE email = ?').get(adminEmail);
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync('admin123', 10); // Change this!
      db.prepare(`
        INSERT INTO players (email, firstName, lastName, password, role, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(adminEmail, 'Admin', 'User', hashedPassword, 'admin', 'active');
      
      console.log('✓ Admin user created');
      console.log(`  Email: ${adminEmail}`);
      console.log('  Password: admin123 (CHANGE THIS!)');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
}

seedAdminUser();

// ============================================================================
// PACKAGE.JSON FOR BACKEND
// ============================================================================
/*
{
  "name": "bowling-tracker-backend",
  "version": "1.0.0",
  "description": "Bowling competition tracking backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.1.2",
    "better-sqlite3": "^9.2.2",
    "nodemailer": "^6.9.7"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
*/

// ============================================================================
// .env FILE FOR BACKEND
// ============================================================================
/*
PORT=5000
DB_PATH=/data/bowling.db
JWT_SECRET=your-very-secret-key-change-this
FRONTEND_URL=http://localhost:3000
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
*/
