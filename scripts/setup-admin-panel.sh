#!/bin/bash

# Quick Setup Script for Admin Panel
# Run this after configuring Auth0 credentials in frontend/.env

set -e

echo "🔧 SecureShip Admin Panel Quick Setup"
echo "======================================"
echo ""

# Check if frontend/.env exists
if [ ! -f "frontend/.env" ]; then
    echo "❌ Error: frontend/.env not found"
    echo "Please create it from frontend/.env.example first"
    exit 1
fi

# Check if Auth0 variables are configured
if grep -q "your-tenant.auth0.com" frontend/.env; then
    echo "⚠️  Warning: Auth0 credentials in frontend/.env are still placeholders"
    echo ""
    echo "Please edit frontend/.env and set:"
    echo "  - NEXT_PUBLIC_AUTH0_DOMAIN"
    echo "  - NEXT_PUBLIC_AUTH0_CLIENT_ID"
    echo "  - NEXT_PUBLIC_AUTH0_AUDIENCE"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Recreating frontend container with new environment..."
docker compose up -d --force-recreate frontend

echo ""
echo "⏳ Waiting for frontend to start..."
sleep 5

echo ""
echo "✅ Checking environment variables..."
docker exec secure-ship-ai-frontend-1 env | grep AUTH0 || echo "⚠️  No AUTH0 variables found"

echo ""
echo "📊 Frontend logs:"
docker logs --tail 10 secure-ship-ai-frontend-1

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Open: http://localhost:3000/admin"
echo "   2. Generate a token: ./scripts/get-admin-token.sh"
echo "   3. Login and test!"
echo ""
