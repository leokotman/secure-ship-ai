.PHONY: help install dev test lint format clean migrate

VENV := ../.venv
PYTHON ?= $(VENV)/bin/python3

help:
	@echo "SecureShip Backend Commands"
	@echo "install       - Install dependencies"
	@echo "dev           - Run development server"
	@echo "migrate       - Run Alembic migrations (requires running Postgres)"
	@echo "test          - Run tests"
	@echo "lint          - Run linters"
	@echo "format        - Format code"
	@echo "clean         - Clean build artifacts"

install:
	$(PYTHON) -m pip install -e ".[dev]"

dev:
	uvicorn secureship.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	alembic upgrade head

test:
	$(PYTHON) -m pytest

lint:
	$(VENV)/bin/ruff check src/
	$(PYTHON) -m mypy src/

format:
	$(PYTHON) -m black src/
	$(VENV)/bin/ruff check --fix src/

clean:
	rm -rf build/ dist/ *.egg-info/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
