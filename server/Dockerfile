# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY src/ ./src/

# Create data directory for SQLite database
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "start"]
