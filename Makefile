.PHONY: help install dev test lint format clean start stop nuke seed

help:
	@echo "SecureShip Monorepo Commands"
	@echo ""
	@echo "everyday:"
	@echo "  make start         - Start Ollama + Docker stack (app on :3000)"
	@echo "  make stop          - Stop Docker stack + Ollama"
	@echo "  make nuke          - stop + wipe database volume (fresh slate)"
	@echo "  make seed          - Seed DB with sample data (run once while stack is up)"
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
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Run linters (backend + frontend)"
	@echo "  make format        - Format code (backend + frontend)"
	@echo ""
	@echo "cleanup:"
	@echo "  make clean         - Clean build artifacts"

start:
	@echo "Starting Ollama..."
	@ollama serve &>/dev/null & sleep 2; true
	@echo "Starting Docker stack..."
	docker compose up --build

stop:
	@echo "Stopping Docker stack..."
	docker compose down
	@echo "Stopping Ollama..."
	@pkill ollama || true
	@echo "Done."

# Wipe the database volume — all data will be lost
nuke:
	docker compose down -v
	@pkill ollama || true
	@echo "Stack stopped and database volume removed."

seed:
	DATABASE_URL=postgresql://postgres:postgres@localhost:5432/secureship \
	  python3 scripts/seed_data.py


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
	@echo "Frontend tests (coming soon)"

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

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down
