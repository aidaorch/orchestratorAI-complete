# Orchestrator AI

AI-powered workflow orchestration platform — FastAPI backend + React frontend, deployed on a Contabo VPS with Docker.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Reverse Proxy | Nginx (SSL termination + SPA routing) |
| Container | Docker + Docker Compose |

---

## Repository Structure

```
orchestrator-ai/
├── backend/          FastAPI application
├── frontend/         React application
├── nginx/            Nginx reverse proxy config
├── docker-compose.yml
├── .env.example      Copy to .env and fill in secrets
└── README.md
```

---

## Local Development

### Prerequisites
- Docker Desktop
- Node.js 20+ (for frontend dev server)
- Python 3.11+ (for backend dev server)

### Quick start with Docker

```bash
git clone https://github.com/YOUR_USERNAME/orchestrator-ai.git
cd orchestrator-ai
cp .env.example .env          # fill in your values
docker compose up --build
```

App runs at `http://localhost` (Nginx) or:
- Frontend dev: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`

---

## Production Deployment on Contabo VPS (Ubuntu)

### 1. Initial server setup

SSH into your VPS as root, then run:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Install Certbot for SSL
apt install -y certbot

# Create a non-root deploy user
adduser deploy
usermod -aG docker deploy
su - deploy
```

### 2. Clone the repository

```bash
cd /home/deploy
git clone https://github.com/YOUR_USERNAME/orchestrator-ai.git
cd orchestrator-ai
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in every value:

```env
DB_PASSWORD=<strong_random_password>
SECRET_KEY=<output of: openssl rand -hex 32>
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://yourdomain.com
```

### 4. Point your domain to the VPS

In your DNS provider, add an **A record**:
```
yourdomain.com  →  YOUR_VPS_IP
www.yourdomain.com  →  YOUR_VPS_IP
```

Wait for DNS to propagate (usually 5–15 minutes).

### 5. Get SSL certificate (Let's Encrypt)

```bash
# Temporarily allow port 80 through firewall
ufw allow 80
ufw allow 443

# Get certificate (replace with your real domain and email)
certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email you@email.com \
  --agree-tos \
  --non-interactive
```

### 6. Update Nginx config with your domain

```bash
nano nginx/nginx.conf
```

Replace both occurrences of `YOUR_DOMAIN` with your actual domain, e.g. `yourdomain.com`.

### 7. Build and start all services

```bash
docker compose up -d --build
```

This starts: PostgreSQL → Redis → Backend → Frontend → Nginx

### 8. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 9. Verify everything is running

```bash
# Check all containers are up
docker compose ps

# Check backend health
curl https://yourdomain.com/api/health

# Tail logs
docker compose logs -f backend
```

Open `https://yourdomain.com` in your browser — you should see the login screen.

---

## SSL Auto-Renewal

Certbot certificates expire every 90 days. Set up a cron job to auto-renew:

```bash
crontab -e
```

Add this line:
```
0 3 * * * certbot renew --quiet && docker compose -f /home/deploy/orchestrator-ai/docker-compose.yml exec nginx nginx -s reload
```

---

## Updating the Application

```bash
cd /home/deploy/orchestrator-ai
git pull
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

---

## Useful Commands

```bash
# View logs
docker compose logs -f                    # all services
docker compose logs -f backend            # backend only

# Restart a service
docker compose restart backend

# Open a shell in the backend container
docker compose exec backend bash

# Database shell
docker compose exec postgres psql -U orchestrator orchestrator_db

# Stop everything
docker compose down

# Stop and wipe all data (DESTRUCTIVE)
docker compose down -v
```

---

## Firewall Setup (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password |
| `SECRET_KEY` | JWT signing key — generate with `openssl rand -hex 32` |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `FRONTEND_URL` | Your production domain, e.g. `https://yourdomain.com` |
