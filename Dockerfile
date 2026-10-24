FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json backend/
RUN cd backend && npm ci
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY backend backend
COPY frontend frontend
RUN cd backend && npx prisma generate && npm run build
RUN cd frontend && npm run build
RUN mkdir -p /app/backend/uploads && chown -R node:node /app
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
