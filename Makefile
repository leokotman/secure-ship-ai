.PHONY: help install dev test lint format clean start start-prod start-prod-no-build pull-prod stop nuke seed smoke

# Local demo/dev uses compose base + bind-mount override (hot reload).
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
# Production-like stack (built images, no source bind mounts).
COMPOSE_PROD := docker compose -f docker-compose.yml

help:
	@echo "SecureShip Monorepo Commands"
	@echo ""
	@echo "everyday:"
	@echo "  make start         - Start Ollama + Docker stack (dev bind-mounts, app on :3000)"
	@echo "  make start-prod    - Start Ollama + production-like Compose (build images)"
	@echo "  make pull-prod     - Pull GHCR images (set SECURESHIP_*_IMAGE in .env first)"
	@echo "  make start-prod-no-build - Start prod stack from pulled/built images (no rebuild)"
	@echo "  make stop          - Stop Docker stack + Ollama"
	@echo "  make nuke          - stop + wipe database volume (fresh slate)"
	@echo "  make seed          - Seed DB with sample data (run once while stack is up)"
	@echo "  make smoke         - Smoke checks (/health, chat validation, admin 401)"
	@echo ""
	@echo "setup commands:"
	@echo "  make install       - Install dependencies (backend + frontend)"
	@echo ""
	@echo "development:"
	@echo "  make dev           - Run both backend and frontend (requires separate terminals)"
	@echo "  make dev-backend   - Backend only (Python FastAPI)"
	@echo "  make dev-frontend  - Frontend only (Next.js)"
	@echo ""
	@echo "testing & linting:"
	@echo "  make test          - Run all tests (backend + frontend)"
	@echo "  make lint          - Run linters (backend + frontend)"
	@echo "  make format        - Format code (backend + frontend)"
	@echo ""
	@echo "cleanup:"
	@echo "  make clean         - Clean build artifacts"

start:
	@echo "Starting Ollama..."
	@ollama serve &>/dev/null & sleep 2; true
	@echo "Starting Docker stack (dev override)..."
	$(COMPOSE_DEV) up --build

# Export root .env + frontend/.env so Compose can substitute NEXT_PUBLIC_* build args.
define export_compose_env
	set -a; \
	[ -f .env ] && . ./.env; \
	[ -f frontend/.env ] && . ./frontend/.env; \
	set +a
endef

start-prod:
	@echo "Starting Ollama..."
	@ollama serve &>/dev/null & sleep 2; true
	@echo "Starting Docker stack (production images)..."
	@$(export_compose_env); $(COMPOSE_PROD) up --build

pull-prod:
	@$(export_compose_env); \
	if [ -z "$${SECURESHIP_BACKEND_IMAGE:-}" ] || [ -z "$${SECURESHIP_FRONTEND_IMAGE:-}" ]; then \
	  echo "Set SECURESHIP_BACKEND_IMAGE and SECURESHIP_FRONTEND_IMAGE in .env (see .env.example)" >&2; \
	  exit 1; \
	fi; \
	$(COMPOSE_PROD) pull

start-prod-no-build:
	@echo "Starting Ollama..."
	@ollama serve &>/dev/null & sleep 2; true
	@echo "Starting Docker stack (existing images, no rebuild)..."
	@$(export_compose_env); $(COMPOSE_PROD) up -d

stop:
	@echo "Stopping Docker stack..."
	-$(COMPOSE_DEV) down
	-$(COMPOSE_PROD) down
	@echo "Stopping Ollama..."
	@pkill ollama || true
	@echo "Done."

# Wipe the database volume — all data will be lost
nuke:
	-$(COMPOSE_DEV) down -v
	-$(COMPOSE_PROD) down -v
	@pkill ollama || true
	@echo "Stack stopped and database volume removed."

seed:
	DATABASE_URL=postgresql://postgres:postgres@localhost:5432/secureship \
	  python3 scripts/seed_data.py

smoke:
	bash scripts/smoke.sh

install:
	@echo "Installing backend..."
	cd backend && pip install -e ".[dev]"
	@echo "Installing frontend..."
	cd frontend && npm install
	@echo "All dependencies installed!"

dev:
	@echo "To run both services, use two terminals:"
	@echo "  Terminal 1: make dev-backend"
	@echo "  Terminal 2: make dev-frontend"

dev-backend:
	cd backend && make dev

dev-frontend:
	cd frontend && make dev

test:
	@echo "Running backend tests..."
	cd backend && make test
	@echo "Running frontend tests..."
	cd frontend && make test

lint:
	@echo "Linting backend..."
	cd backend && make lint
	@echo "Linting frontend..."
	cd frontend && make lint

format:
	@echo "Formatting backend..."
	cd backend && make format
	@echo "Formatting frontend..."
	cd frontend && make format

clean:
	@echo "Cleaning backend..."
	cd backend && make clean
	@echo "Cleaning frontend..."
	cd frontend && make clean
	@echo "All clean!"
