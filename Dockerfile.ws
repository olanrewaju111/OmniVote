# ─── OmniVote WebSocket Server Dockerfile ────────────────────────────
# Lightweight image for the standalone WS server
# ─────────────────────────────────────────────────────────────────────────

FROM node:24-alpine AS deps

RUN apk update && apk upgrade --no-cache && apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./

RUN \
  if [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f bun.lock ]; then \
    npm install -g bun && bun install --frozen-lockfile; \
  else \
    npm install; \
  fi

# ─── Runner ─────────────────────────────────────────────────────────────
FROM node:24-alpine

RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache wget ca-certificates dumb-init tzdata && \
    rm -rf /var/cache/apk/*

ENV TZ=Africa/Lagos
ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 omnivote

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY src/lib/ws-server.ts ./src/lib/ws-server.ts
COPY src/lib/db.ts ./src/lib/db.ts
COPY src/lib/ws-broadcast.ts ./src/lib/ws-broadcast.ts
COPY src/lib/auth.ts ./src/lib/auth.ts
COPY src/lib/logger.ts ./src/lib/logger.ts
COPY src/lib/rate-limit.ts ./src/lib/rate-limit.ts
COPY src/lib/sanitize.ts ./src/lib/sanitize.ts
COPY src/types/ ./src/types/

RUN chown -R omnivote:nodejs /app
USER omnivote

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "src/lib/ws-server.ts"]
