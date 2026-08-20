# ─── OmniVote Makefile ──────────────────────────────────────────
# Convenience targets for Docker operations.
#
# Usage:
#   make help          Show all targets
#   make dev           Start dev stack with hot-reload
#   make up            Start production stack
#   make build         Build production images
# ─────────────────────────────────────────────────────────────────────────

.PHONY: help dev up down build logs clean rebuild shell db-push db-seed \
       db-reset db-migrate test test-coverage storybook \
       monitoring logs-app logs-ws logs-db logs-redis ps

# ── Defaults ──────────────────────────────────────────────────────────
DC_BASE = docker compose
DC_DEV  = $(DC_BASE) -f docker-compose.yml -f docker-compose.dev.yml
DC_PROD = $(DC_BASE) -f docker-compose.yml -f docker-compose.prod.yml

# ── Help ─────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ───────────────────────────────────────────────────────
dev: ## Start dev stack (hot-reload, exposed ports)
	$(DC_DEV) up -d --build
	@echo ""
	@echo "  App:      http://localhost:${APP_PORT:-3000}"
	@echo "  WebSocket: ws://localhost:${WS_PORT:-3001}"
	@echo "  Postgres:  localhost:${POSTGRES_PORT:-5432}"
	@echo "  Redis:     localhost:${REDIS_PORT:-6379}"
	@echo ""

# ── Production ───────────────────────────────────────────────────────
up: ## Start production stack (nginx + app + ws + postgres + redis)
	$(DC_PROD) up -d --build
	@echo ""
	@echo "  OmniVote:  http://localhost:${NGINX_HTTP_PORT:-80}"
	@echo "  Postgres:  localhost:${POSTGRES_PORT:-5432}"
	@echo "  Redis:     localhost:${REDIS_PORT:-6379}"
	@echo ""

up-monitoring: ## Start production + Prometheus + Grafana
	$(DC_PROD) --profile monitoring up -d --build
	@echo ""
	@echo "  OmniVote:  http://localhost:${NGINX_HTTP_PORT:-80}"
	@echo "  Grafana:   http://localhost:${GRAFANA_PORT:-3002}"
	@echo "  Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
	@echo ""

down: ## Stop all containers
	$(DC_BASE) down

down-clean: ## Stop and remove volumes (DESTROYS DATA)
	$(DC_BASE) down -v

# ── Build ─────────────────────────────────────────────────────────────
build: ## Build production images
	$(DC_BASE) build

rebuild: ## Rebuild without cache
	$(DC_BASE) build --no-cache

# ── Logs ──────────────────────────────────────────────────────────────
logs: ## Follow all logs
	$(DC_BASE) logs -f

logs-app: ## Follow app logs
	$(DC_BASE) logs -f app

logs-ws: ## Follow websocket logs
	$(DC_BASE) logs -f ws

logs-db: ## Follow postgres logs
	$(DC_BASE) logs -f postgres

logs-redis: ## Follow redis logs
	$(DC_BASE) logs -f redis

logs-nginx: ## Follow nginx logs
	$(DC_BASE) logs -f nginx

# ── Database ───────────────────────────────────────────────────────────
db-push: ## Push Prisma schema to database
	$(DC_BASE) exec app npx prisma db push

db-migrate: ## Run Prisma migrations
	$(DC_BASE) exec app npx prisma migrate deploy

db-seed: ## Seed database with sample data
	$(DC_BASE) exec app npx tsx scripts/seed.ts

db-reset: ## Reset database (WARNING: destroys data)
	$(DC_BASE) exec app npx prisma migrate reset --force

db-studio: ## Open Prisma Studio
	$(DC_BASE) exec app npx prisma studio

# ── Testing ────────────────────────────────────────────────────────────
test: ## Run unit tests in app container
	$(DC_BASE) exec app npm test

test-coverage: ## Run tests with coverage
	$(DC_BASE) exec app npm run test:coverage

# ── Storybook ──────────────────────────────────────────────────────────
storybook: ## Start Storybook in dev container
	$(DC_DEV) exec app npm run storybook

# ── Shell ──────────────────────────────────────────────────────────────
shell: ## Open shell in app container
	$(DC_BASE) exec app sh

shell-db: ## Open psql in postgres container
	$(DC_BASE) exec postgres psql -U ${POSTGRES_USER:-omnivote} -d ${POSTGRES_DB:-omnivote}

shell-redis: ## Open redis-cli
	$(DC_BASE) exec redis redis-cli

# ── Status ─────────────────────────────────────────────────────────────
ps: ## Show running containers
	$(DC_BASE) ps

# ── Clean ──────────────────────────────────────────────────────────────
clean: ## Remove images, stopped containers, and build cache
	docker system prune -f
	docker builder prune -f
