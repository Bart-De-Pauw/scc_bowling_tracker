# Bowling Competition Tracker - Complete Setup Guide

## Overview

This is a full-stack bowling league management system built with:
- **Frontend**: React
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Deployment**: Docker on Raspberry Pi

## Project Structure

```
bowling-tracker/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── database.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── App.css
│       └── index.js
├── docker-compose.yml
├── .env
└── data/
    └── bowling.db (created automatically)
```

## Prerequisites

### For Local Development (Windows/Mac/Linux)
- Node.js 18+ (https://nodejs.org/)
- npm (comes with Node.js)
- Docker Desktop (https://www.docker.com/)
- Git (optional)

### For Raspberry Pi Deployment
- Raspberry Pi 4 (4GB+ RAM recommended)
- Raspberry Pi OS (latest)
- SSH access
- About 2GB free disk space

## Local Development Setup

### 1. Install Node.js
Download and install from https://nodejs.org/ (LTS version)

### 2. Create Project Directory
```bash
mkdir bowling-tracker
cd bowling-tracker
```

### 3. Set Up Backend

```bash
mkdir backend
cd backend

# Create package.json
npm init -y

# Install dependencies
npm install express cors bcrypt jsonwebtoken better-sqlite3 nodemailer

# Copy server.js and database.js into this directory
# (from the code artifacts provided)

cd ..
```

### 4. Set Up Frontend

```bash
# Create React app
npx create-react-app frontend

cd frontend

# Copy App.js and App.css
# (from the code artifacts provided)

npm install axios

cd ..
```

### 5. Environment Setup

Create `.env` file in root:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
JWT_SECRET=change-this-to-a-very-long-random-string
FRONTEND_URL=http://localhost:3000
```

### 6. Run Locally (Without Docker)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
Server runs on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
App opens on http://localhost:3000

## Docker Setup for Raspberry Pi

### 1. Prepare Raspberry Pi

SSH into your Pi:
```bash
ssh pi@your-pi-ip
# Default password: raspberry
```

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add pi user to docker group (no sudo needed)
sudo usermod -aG docker pi

# Install Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 3. Set Up Application

```bash
# Create project directory
mkdir -p ~/bowling-tracker
cd ~/bowling-tracker

# Create directory structure
mkdir -p backend frontend data

# Copy all files from docker-compose.yml, backend/, and frontend/
# Use WinSCP, scp, or another file transfer tool
# Or clone from git if you push to a repository

scp -r ./bowling-tracker pi@your-pi-ip:~/
```

### 4. Configure Environment

On the Raspberry Pi:
```bash
cd ~/bowling-tracker

# Create .env file
cat > .env << EOF
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
JWT_SECRET=$(openssl rand -base64 32)
FRONTEND_URL=http://your-pi-ip:3000
EOF
```

### 5. Build and Start Services

```bash
# Build Docker images (takes 5-10 minutes first time)
docker-compose build

# Start services in background
docker-compose up -d

# Check status
docker-compose ps

# View logs (Ctrl+C to exit)
docker-compose logs -f
```

### 6. Access the Application

- **Frontend**: http://your-pi-ip:3000
- **Backend API**: http://your-pi-ip:5000
- **Default Admin Login**:
  - Email: admin@bowling.local
  - Password: admin123 (CHANGE THIS!)

## First-Time Setup

### 1. Change Admin Password
1. Login with admin@bowling.local / admin123
2. Go to Admin Panel
3. (Add password change feature or manually update database)

### 2. Register Players
1. Go to Admin Panel → Register Player
2. Enter player details
3. System sends email invite to player
4. Player clicks link and sets their password

### 3. Create Season
1. Go to Admin Panel → Create Evening
2. Enter Evening Number (1, 2, 3... up to 15)
3. Set Playing Date
4. Repeat for all 15 evenings

### 4. Create Teams & Add Scores
1. Go to Evenings page
2. Select an evening
3. Click "Create Teams"
4. Add 3 players per team
5. Players/team captain enters scores for 3 games

## Features

### For Players
- View their stats (total points, average, handicap)
- Submit scores for their games
- See leaderboards (individual & team)
- Accept email invite to join league

### For Team Captain
- Submit scores for entire team
- View team statistics
- See team standings

### For Administrators
- Register new players (bulk email invites)
- Create seasons/evenings
- Create teams (can change weekly)
- Create ghost teams (if odd number of teams)
- View and edit all scores
- Manage player access

## Handicap Calculation

Handicap is automatically calculated:
- **Trigger**: After player's first 3 games (1 evening)
- **Formula**: `max(0, (200 - season_moving_average) × 0.7)`
- **Moving Average**: Average of last 10 evening scores (3 games each)

## Useful Docker Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs -f  # Follow log output

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose down
docker-compose up -d --build

# Access database directly
docker exec -it bowling-backend sh
# Then: sqlite3 /data/bowling.db

# Backup database
docker exec bowling-backend cp /data/bowling.db /data/bowling.db.backup

# Copy file from container
docker cp bowling-backend:/data/bowling.db ./backup/
```

## Backup Strategy

### Automated Daily Backups (on Raspberry Pi)

Edit crontab:
```bash
crontab -e
```

Add this line (backs up daily at 2 AM):
```
0 2 * * * docker exec bowling-backend sh -c 'cp /data/bowling.db /data/bowling.db.$(date +\%Y\%m\%d)'
```

Keep only 30 days:
```
0 3 * * * docker exec bowling-backend sh -c 'find /data -name "bowling.db.*" -mtime +30 -delete'
```

### Manual Backup
```bash
docker cp bowling-backend:/data/bowling.db ./bowling.db.backup
```

## Auto-Start on Boot (Optional)

Create systemd service:

```bash
sudo tee /etc/systemd/system/bowling-tracker.service > /dev/null << EOF
[Unit]
Description=Bowling Tracker Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/bowling-tracker
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable bowling-tracker.service
sudo systemctl start bowling-tracker.service

# Check status
sudo systemctl status bowling-tracker.service
```

## Troubleshooting

### "Connection refused" when accessing website
- Wait 30 seconds after `docker-compose up -d`
- Check logs: `docker-compose logs`
- Verify containers are running: `docker-compose ps`

### Database locked errors
- The database file might be corrupted
- Stop containers: `docker-compose down`
- Restore from backup or delete `/data/bowling.db` (will recreate on next start)

### Email invites not sending
- Check .env file has correct EMAIL_USER and EMAIL_PASSWORD
- For Gmail: Use app-specific password (https://myaccount.google.com/apppasswords)
- Check logs: `docker-compose logs backend | grep -i email`

### Out of memory on Pi
- Close other applications
- Increase swap: `sudo dphys-swapfile swapoff` then edit `/etc/dphys-swapfile`
- Use Raspberry Pi 4 with 4GB+ RAM

## Security Notes

- Change default admin password immediately
- Use strong JWT_SECRET in .env
- Restrict network access (firewall)
- Use HTTPS in production (nginx with SSL)
- Regular backups
- Update Docker images periodically

## Future Enhancements

- Email notifications for scores
- Mobile app
- Handicap adjustment options
- Match statistics (teams vs teams)
- Photo uploads for profiles
- PDF score sheets
- League export/reporting

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify .env file is correct
3. Ensure Raspberry Pi has enough disk space: `df -h`
4. Restart everything: `docker-compose down && docker-compose up -d`

---

**Happy Bowling! 🎳**
