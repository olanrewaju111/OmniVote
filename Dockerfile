# ─── OmniVote Production Dockerfile ─────────────────────────────────
# Multi-stage build: deps → build → runner
# Task ID: 6 — Phase 14: Deployment & DevOps
# ─────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Dependencies ───────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfiles first for best layer caching
COPY package.json bun.lock* package-lock.json* ./

# Install dependencies (bun preferred, npm fallback)
RUN \
  if [ -f bun.lock ]; then \
    npm install -g bun && \
    bun install --frozen-lockfile --production=false; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  else \
    npm install; \
  fi

# ─── Stage 2: Build ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx next build

# Copy static assets and public into standalone output
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/

# ─── Stage 3: Production Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

LABEL maintainer="OmniVote Team <dev@omnivote.app>"
LABEL description="OmniVote — Real-time election monitoring dashboard"
LABEL version="0.2.0"
LABEL org.opencontainers.image.source="https://github.com/omnivote/omnivote"

# Security: minimal runtime deps + security updates
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache wget ca-certificates dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 omnivote

# Create required directories
RUN mkdir -p /app/data /app/logs && \
    chown -R omnivote:nodejs /app/data /app/logs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./

# Copy Prisma schema (for migrations at runtime)
COPY --from=builder /app/prisma ./prisma/

# Copy node_modules with Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set ownership
RUN chown -R omnivote:nodejs /app

USER omnivote

EXPOSE 3000

VOLUME ["/app/data"]

# Health check via /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
