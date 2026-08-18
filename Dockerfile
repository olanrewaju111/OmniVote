# ─── OmniVote Production Dockerfile ─────────────────────────────────
# Phase 14: Enhanced with security hardening, non-root, multi-arch,
# minimal attack surface, and health-check awareness.
#
# Build:  docker build -t omnivote:latest .
# Run:    docker run -p 3000:3000 --env-file .env omnivote:latest
# ─────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Dependencies ───────────────────────────────────────────────
FROM node:24-alpine AS deps

# Install security updates and build deps
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libc6-compat dumb-init

WORKDIR /app

# Copy lockfiles first (best cache layer)
COPY package.json bun.lock* package-lock.json* ./

# Install dependencies based on available lockfile
RUN \
  if [ -f bun.lock ]; then \
    corepack enable bun && bun install --frozen-lockfile --production=false; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  else \
    npm i; \
  fi && \
  # Remove dev-only postinstall scripts that may run at build time
   npm cache clean --force 2>/dev/null || true && \
  rm -rf /tmp/* /root/.npm 2>/dev/null || true

# ─── Stage 2: Build ──────────────────────────────────────────────────────
FROM node:24-alpine AS builder

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs prisma schema)
RUN npx prisma generate

# Build Next.js (standalone output for minimal image)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx next build

# Copy static assets into standalone directory for self-contained output
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public        .next/standalone/

# ─── Stage 3: Production Runtime ─────────────────────────────────────────
FROM node:24-alpine AS runner

# Security: Install minimal runtime deps + security updates
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init wget ca-certificates && \
    rm -rf /var/cache/apk/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as non-root user (security hardening)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 omnivote

# Create required directories
RUN mkdir -p /app/data /app/logs && \
    chown -R omnivote:nodejs /app/data /app/logs

# Copy standalone build output (already minimized by Next.js)
COPY --from=builder /app/.next/standalone ./

# Copy Prisma schema (needed for future migrations)
COPY --from=builder /app/prisma ./prisma/

# Set ownership for all files
RUN chown -R omnivote:nodejs /app

USER omnivote

EXPOSE 3000

# Persistent data volume
VOLUME ["/app/data"]

# Readiness probe (fast — just checks if the process accepts connections)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
