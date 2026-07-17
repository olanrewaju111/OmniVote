# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN \
  if [ -f bun.lock ]; then \
    corepack enable bun && bun install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  else \
    npm i; \
  fi

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output configured in next.config.ts)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Copy static assets & public into standalone for self-contained output
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public        .next/standalone/

# ─── Stage 3: Production Runtime ─────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 omnivote

# Create database directory with correct permissions
RUN mkdir -p /app/data && chown omnivote:nodejs /app/data

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./

# Copy Prisma schema (needed for potential future migrations)
COPY --from=builder /app/prisma ./prisma/

# Set ownership
RUN chown -R omnivote:nodejs /app

USER omnivote

EXPOSE 3000

# Database volume mount point
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]