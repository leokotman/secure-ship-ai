.PHONY: help install dev build lint test format clean generate

help:
	@echo "SecureShip Frontend Commands"
	@echo "install       - Install dependencies"
	@echo "dev           - Run development server"
	@echo "build         - Build for production"
	@echo "start         - Start production server"
	@echo "lint          - Run linters"
	@echo "test          - Run tests"
	@echo "format        - Format code"
	@echo "generate      - Regenerate Orval types from backend OpenAPI"
	@echo "clean         - Clean build artifacts"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

test:
	npm run test

format:
	npm run format

generate:
	npm run generate

clean:
	rm -rf .next/ node_modules/
	npm cache clean --force
