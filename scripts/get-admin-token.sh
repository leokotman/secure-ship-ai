#!/bin/bash

# Admin Test Token Generator
# 
# This script helps generate a test Auth0 access token for manual testing.
# It uses the Client Credentials flow to get a machine-to-machine token.

set -e

echo "🔐 SecureShip Admin Token Generator"
echo "===================================="
echo ""

# Load environment variables
if [ -f backend/.env ]; then
    source backend/.env
else
    echo "❌ Error: backend/.env not found"
    echo "Please create backend/.env with AUTH0_* variables"
    exit 1
fi

# Check required variables
if [ -z "$AUTH0_DOMAIN" ] || [ -z "$AUTH0_CLIENT_ID" ] || [ -z "$AUTH0_CLIENT_SECRET" ] || [ -z "$AUTH0_AUDIENCE" ]; then
    echo "❌ Error: Missing Auth0 configuration"
    echo ""
    echo "Required variables in backend/.env:"
    echo "  - AUTH0_DOMAIN"
    echo "  - AUTH0_CLIENT_ID"
    echo "  - AUTH0_CLIENT_SECRET"
    echo "  - AUTH0_AUDIENCE"
    exit 1
fi

echo "📋 Configuration:"
echo "   Domain: $AUTH0_DOMAIN"
echo "   Client ID: ${AUTH0_CLIENT_ID:0:20}..."
echo "   Audience: $AUTH0_AUDIENCE"
echo ""

echo "🔄 Requesting token from Auth0..."
echo ""

# Request token using Client Credentials flow
RESPONSE=$(curl -s --request POST \
  --url "https://$AUTH0_DOMAIN/oauth/token" \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "'"$AUTH0_CLIENT_ID"'",
    "client_secret": "'"$AUTH0_CLIENT_SECRET"'",
    "audience": "'"$AUTH0_AUDIENCE"'",
    "grant_type": "client_credentials"
  }')

# Check if we got an error
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Error from Auth0:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Extract access token
ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to extract access token"
    echo "Response:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

echo "✅ Token generated successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Access Token:"
echo ""
echo "$ACCESS_TOKEN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Usage:"
echo ""
echo "1. Copy the token above"
echo "2. Go to http://localhost:3000/admin"
echo "3. Paste the token and click 'Login with Token'"
echo ""
echo "Or test the API directly:"
echo ""
echo "curl -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
echo "     http://localhost:8000/admin/dashboard"
echo ""
