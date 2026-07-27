.PHONY: help install dev test lint format clean

help:
	@echo "SecureShip Monorepo Commands"
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
	@echo ""
	@echo "docker:"
	@echo "  make docker-up     - Start services with Docker Compose (Week 3+)"
	@echo "  make docker-down   - Stop Docker Compose services"

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
