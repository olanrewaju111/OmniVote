# ─── OmniVote Production Dockerfile ─────────────────────────────────
# Multi-stage build: deps -> build -> runner
# No Nginx — Next.js standalone handles all traffic directly.
# ─────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Dependencies ───────────────────────────────────────────────
FROM node:24-alpine AS deps

RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfiles first for best layer caching
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies (prefer npm ci with lockfile, fallback to npm install)
RUN \
  if [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f bun.lock ]; then \
    npm install -g bun && bun install --frozen-lockfile --production=false; \
  else \
    npm install; \
  fi

# ─── Stage 2: Build ──────────────────────────────────────────────────────
FROM node:24-alpine AS builder

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

# Build-time secrets (needed by modules that validate env vars at import)
ARG JWT_SECRET=build-time-placeholder
ARG OMNIVOTE_ENCRYPTION_KEY=build-time-placeholder
ENV JWT_SECRET=${JWT_SECRET}
ENV OMNIVOTE_ENCRYPTION_KEY=${OMNIVOTE_ENCRYPTION_KEY}

RUN npx next build

# Copy static assets and public into standalone output
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/

# ─── Stage 3: Production Runner ──────────────────────────────────────────
FROM node:24-alpine AS runner

LABEL maintainer="OmniVote Team <dev@omnivote.app>"
LABEL description="OmniVote - Real-time election monitoring dashboard"
LABEL version="0.2.0"
LABEL org.opencontainers.image.source="https://github.com/omnivote/omnivote"

# Security: minimal runtime deps + security updates
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache wget ca-certificates dumb-init su-exec tzdata && \
    rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Africa/Lagos

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

# Copy Prisma schema, CLI, client and engine (for db push at runtime)
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy init script
COPY docker/init-entrypoint.sh /app/init-entrypoint.sh
RUN chmod +x /app/init-entrypoint.sh

# Set ownership
RUN chown -R omnivote:nodejs /app

# Run as root so init script can fix volume permissions, then drops to omnivote
EXPOSE 3000 9323

VOLUME ["/app/data"]

# Health check via /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/init-entrypoint.sh"]
