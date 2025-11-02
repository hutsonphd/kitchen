# Kitchen Calendar Kiosk - Docker Deployment

This guide explains how to run the Kitchen Calendar Kiosk application using Docker.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/hutsonphd/kitchen.git
cd kitchen
```

### 2. Build and run with Docker Compose

```bash
docker-compose up -d
```

This will:
- Build the frontend React application
- Build the backend CalDAV proxy server
- Start both services in detached mode

### 3. Access the application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001

## Docker Compose Services

### Frontend Service
- **Container**: `kitchen-frontend`
- **Port**: 80
- **Technology**: React + Vite + Nginx
- **Build Context**: Root directory

### Backend Service
- **Container**: `kitchen-backend`
- **Port**: 3001
- **Technology**: Node.js Express server
- **Build Context**: `./server` directory

## Available Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Frontend only
docker-compose logs -f frontend

# Backend only
docker-compose logs -f backend
```

### Rebuild services
```bash
docker-compose up -d --build
```

### Remove all containers and volumes
```bash
docker-compose down -v
```

## Configuration

### Environment Variables

The backend service uses the following environment variables (can be customized in `docker-compose.yml`):

- `NODE_ENV`: Set to `production`
- `PORT`: Backend port (default: 3001)

### Nginx Configuration

The frontend uses Nginx as a web server. Configuration is in `nginx.conf`:
- Serves static files from `/usr/share/nginx/html`
- Proxies `/api/*` requests to the backend service
- Enables gzip compression
- Configures cache headers for static assets

## Troubleshooting

### Check service health
```bash
docker-compose ps
```

### View detailed logs
```bash
docker-compose logs --tail=100 -f
```

### Restart a specific service
```bash
docker-compose restart frontend
docker-compose restart backend
```

### Access container shell
```bash
# Frontend
docker exec -it kitchen-frontend sh

# Backend
docker exec -it kitchen-backend sh
```

## Production Deployment

For production deployment:

1. **Use a reverse proxy** (e.g., Nginx, Traefik) with SSL/TLS certificates
2. **Set appropriate resource limits** in docker-compose.yml
3. **Configure logging** for production monitoring
4. **Use Docker secrets** for sensitive credentials
5. **Enable automatic restarts** with `restart: unless-stopped`

Example with resource limits:

```yaml
services:
  frontend:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ HTTP (port 80)
         ▼
┌─────────────────┐
│ Frontend (Nginx)│
│  React App      │
└────────┬────────┘
         │ API proxy (/api/*)
         ▼
┌─────────────────┐
│ Backend (Node)  │
│  CalDAV Proxy   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CalDAV Server  │
│  (iCloud, etc)  │
└─────────────────┘
```

## Notes

- The frontend container waits for the backend health check to pass before starting
- Data is stored in browser localStorage (no persistent volumes needed)
- Both services use Alpine Linux base images for smaller size
- Health checks are configured for both services
