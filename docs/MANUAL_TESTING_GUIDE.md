# Manual Testing Guide - Admin API Endpoints

This guide shows you how to manually test the Admin API endpoints using both **terminal (curl)** and **browser** methods.

---

## Prerequisites

### 1. Start the Backend Server

```bash
# From project root
cd backend
make start
# OR
docker-compose up

# Backend should be running on http://localhost:8000
```

### 2. Get an Auth0 Test Token

You have several options to get a valid JWT token:

#### Option A: Auth0 Dashboard API Explorer (Easiest)
1. Go to your Auth0 Dashboard: https://manage.auth0.com
2. Navigate to: **Applications** → Your Application → **APIs** → **API Explorer**
3. Click **"Test"** tab
4. Copy the `access_token` from the test request

#### Option B: Using Auth0 Test Application
1. Go to: https://manage.auth0.com/dashboard
2. Navigate to: **Applications** → **APIs** → Your API
3. Click **"Test"** tab
4. Use the curl command provided or copy the token directly

#### Option C: Manual Token Request (Advanced)
```bash
curl --request POST \
  --url https://YOUR_AUTH0_DOMAIN/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "YOUR_AUDIENCE",
    "grant_type": "client_credentials"
  }'
```

#### Option D: For Local Testing (Skip Auth - Development Only)

If you want to test without Auth0 during development, you can temporarily modify `admin.py`:

```python
# In admin.py, temporarily change:
# _admin: dict[str, Any] = Depends(require_admin)
# TO:
# _admin: dict[str, Any] = {}  # Skip auth for local testing

# ⚠️ REMEMBER TO REVERT THIS BEFORE COMMITTING!
```

**For this guide, we'll assume you have a token saved:**

```bash
export ADMIN_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Method 1: Terminal Testing with curl

### Check Server Health (No Auth Required)

```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "version": "0.2.0"
}
```

---

### 1. List All Shipments

```bash
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**With Filters:**
```bash
# Filter by status
curl -X GET "http://localhost:8000/admin/shipments?status=in_transit" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by customer_id (replace with actual UUID from seed data)
curl -X GET "http://localhost:8000/admin/shipments?customer_id=YOUR_CUSTOMER_UUID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Include soft-deleted shipments
curl -X GET "http://localhost:8000/admin/shipments?include_deleted=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Pagination
curl -X GET "http://localhost:8000/admin/shipments?page=1&page_size=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### 2. Get Dashboard Statistics

```bash
curl -X GET "http://localhost:8000/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "total_shipments": 5,
  "by_status": {
    "label_created": 1,
    "in_transit": 2,
    "delivered": 2
  },
  "recent_shipments": [...]
}
```

---

### 3. Create a New Shipment

First, get a customer_id from existing data:

```bash
# If you have seed data, get customer IDs
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.shipments[0].customer_id'
```

Then create shipment:

```bash
curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "REPLACE_WITH_ACTUAL_UUID",
    "tracking_number": "TEST-'.$(date +%s)'",
    "status": "label_created",
    "carrier": "FedEx",
    "origin": "New York, NY",
    "destination": "Los Angeles, CA",
    "estimated_delivery": "2026-08-25T14:00:00Z"
  }'
```

**Success Response (201 Created):**
```json
{
  "id": "newly-generated-uuid",
  "customer_id": "...",
  "tracking_number": "TEST-1724268000",
  "status": "label_created",
  "carrier": "FedEx",
  ...
}
```

**Error Response (404 if customer not found):**
```json
{
  "detail": "Customer {id} not found"
}
```

---

### 4. Update a Shipment

```bash
# Save shipment ID from previous response
export SHIPMENT_ID="replace-with-actual-uuid"

curl -X PUT "http://localhost:8000/admin/shipments/$SHIPMENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_transit"
  }'
```

**Partial Update (only update specific fields):**
```bash
curl -X PUT "http://localhost:8000/admin/shipments/$SHIPMENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "out_for_delivery",
    "estimated_delivery": "2026-08-22T10:00:00Z"
  }'
```

---

### 5. Add a Package to Shipment

```bash
curl -X POST "http://localhost:8000/admin/packages" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "'"$SHIPMENT_ID"'",
    "description": "MacBook Pro 16-inch",
    "weight_kg": 2.5,
    "declared_value": 2999.99
  }'
```

---

### 6. Soft-Delete a Shipment

```bash
curl -X DELETE "http://localhost:8000/admin/shipments/$SHIPMENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Success Response:** 204 No Content (empty response)

**Verify it's soft-deleted:**
```bash
# Without include_deleted - should NOT appear
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.shipments[] | select(.id=="'$SHIPMENT_ID'")'

# With include_deleted=true - SHOULD appear with deleted_at timestamp
curl -X GET "http://localhost:8000/admin/shipments?include_deleted=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.shipments[] | select(.id=="'$SHIPMENT_ID'")'
```

---

### 7. Test Auth Failures (Security Verification)

```bash
# No token - should return 401
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Content-Type: application/json"

# Invalid token - should return 401
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer invalid-token-here" \
  -H "Content-Type: application/json"

# Expired token - should return 401
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "detail": "Invalid or expired token"
}
```

---

## Method 2: Browser Testing (Interactive)

### Option A: Using Swagger/OpenAPI UI

FastAPI automatically generates interactive API docs:

1. **Open in browser:**
   ```
   http://localhost:8000/docs
   ```

2. **Authorize with your token:**
   - Click the green **"Authorize"** button at the top right
   - Enter: `Bearer YOUR_TOKEN_HERE`
   - Click **"Authorize"**
   - Click **"Close"**

3. **Test endpoints:**
   - Expand any endpoint (e.g., `GET /admin/shipments`)
   - Click **"Try it out"**
   - Fill in parameters (optional)
   - Click **"Execute"**
   - View response below

**Screenshot of what you'll see:**
```
GET /admin/shipments
  [ Try it out ]

Parameters:
  status: [dropdown: label_created, in_transit, ...]
  customer_id: [text input]
  tracking_number: [text input]
  include_deleted: false
  page: 1
  page_size: 50

[ Execute ]

Responses:
  200 Success
  {
    "shipments": [...],
    "total": 5,
    "page": 1,
    "page_size": 50
  }
```

---

### Option B: Using Browser Extensions

#### 1. **Postman** (Desktop App or Web)
1. Download: https://www.postman.com/downloads/
2. Create a new request
3. Set method: `GET`
4. Set URL: `http://localhost:8000/admin/shipments`
5. Go to **Headers** tab:
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN_HERE`
6. Click **Send**

#### 2. **Thunder Client** (VS Code Extension)
1. Install extension in VS Code: "Thunder Client"
2. Click Thunder Client icon in sidebar
3. New Request → `GET http://localhost:8000/admin/shipments`
4. Add header: `Authorization: Bearer YOUR_TOKEN`
5. Click **Send**

#### 3. **REST Client** (VS Code Extension)
1. Install "REST Client" extension
2. Create file: `test-requests.http`
3. Add:
```http
### Health Check
GET http://localhost:8000/health

### List Shipments
GET http://localhost:8000/admin/shipments
Authorization: Bearer {{token}}

### Create Shipment
POST http://localhost:8000/admin/shipments
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "customer_id": "replace-with-uuid",
  "tracking_number": "TEST-123",
  "status": "label_created",
  "carrier": "FedEx",
  "origin": "NYC",
  "destination": "LA"
}
```
4. Click **"Send Request"** link above each request

---

## Method 3: Using HTTPie (Prettier than curl)

Install HTTPie:
```bash
# macOS
brew install httpie

# Linux
apt install httpie

# pip
pip install httpie
```

**Usage:**
```bash
# Much cleaner syntax than curl!
http GET localhost:8000/admin/shipments \
  Authorization:"Bearer $ADMIN_TOKEN"

# POST with JSON (automatic Content-Type)
http POST localhost:8000/admin/shipments \
  Authorization:"Bearer $ADMIN_TOKEN" \
  customer_id="uuid-here" \
  tracking_number="TEST-456" \
  status="label_created" \
  carrier="UPS" \
  origin="Boston" \
  destination="Seattle"
```

---

## Complete Test Workflow

Here's a complete end-to-end test script:

```bash
#!/bin/bash
# Save as: test-admin-api.sh

# Set your token
export ADMIN_TOKEN="your-token-here"
BASE_URL="http://localhost:8000"

echo "🏥 1. Health Check..."
curl -s "$BASE_URL/health" | jq

echo -e "\n📊 2. Get Dashboard Stats..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/admin/dashboard" | jq

echo -e "\n📦 3. List Existing Shipments..."
SHIPMENTS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/admin/shipments")
echo "$SHIPMENTS" | jq '.shipments[] | {id, tracking_number, status}'

# Get first customer_id from existing data
CUSTOMER_ID=$(echo "$SHIPMENTS" | jq -r '.shipments[0].customer_id')
echo "Using customer_id: $CUSTOMER_ID"

echo -e "\n➕ 4. Create New Shipment..."
NEW_SHIPMENT=$(curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/admin/shipments" \
  -d '{
    "customer_id": "'"$CUSTOMER_ID"'",
    "tracking_number": "TEST-'"$(date +%s)"'",
    "status": "label_created",
    "carrier": "FedEx",
    "origin": "New York, NY",
    "destination": "Los Angeles, CA"
  }')
echo "$NEW_SHIPMENT" | jq

SHIPMENT_ID=$(echo "$NEW_SHIPMENT" | jq -r '.id')
echo "Created shipment: $SHIPMENT_ID"

echo -e "\n✏️  5. Update Shipment Status..."
curl -s -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/admin/shipments/$SHIPMENT_ID" \
  -d '{"status": "in_transit"}' | jq

echo -e "\n📦 6. Add Package to Shipment..."
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/admin/packages" \
  -d '{
    "shipment_id": "'"$SHIPMENT_ID"'",
    "description": "Test Package",
    "weight_kg": 5.5,
    "declared_value": 150.00
  }' | jq

echo -e "\n🗑️  7. Soft-Delete Shipment..."
curl -s -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/admin/shipments/$SHIPMENT_ID"
echo "Deleted (204 No Content expected)"

echo -e "\n✅ 8. Verify Deleted (should not appear)..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/admin/shipments" | jq '.shipments[] | select(.id=="'"$SHIPMENT_ID"'")'

echo -e "\n✅ 9. Verify Deleted with include_deleted=true (should appear)..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/admin/shipments?include_deleted=true" | \
  jq '.shipments[] | select(.id=="'"$SHIPMENT_ID"'") | {id, tracking_number, deleted_at}'

echo -e "\n🎉 All tests complete!"
```

**Run it:**
```bash
chmod +x test-admin-api.sh
./test-admin-api.sh
```

---

## Testing Customer Isolation (Critical Security Test)

This verifies that customers can't see soft-deleted shipments:

### Step 1: Create and Delete a Shipment (Admin)
```bash
# Create
NEW_SHIPMENT=$(curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8000/admin/shipments" \
  -d '{
    "customer_id": "CUSTOMER_UUID_HERE",
    "tracking_number": "SEC-TEST-123",
    "status": "label_created",
    "carrier": "FedEx",
    "origin": "NYC",
    "destination": "LA"
  }')

SHIPMENT_ID=$(echo "$NEW_SHIPMENT" | jq -r '.id')
echo "Created: $SHIPMENT_ID"
```

### Step 2: Verify Customer Can See It
1. Open http://localhost:3000 in browser
2. Verify identity as the customer (use phone number)
3. Ask: **"What shipments do I have?"**
4. ✅ Should see `SEC-TEST-123` in the response

### Step 3: Admin Deletes It
```bash
curl -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/admin/shipments/$SHIPMENT_ID"
```

### Step 4: Verify Customer Can't See It
1. In the same chat session, ask again: **"What shipments do I have?"**
2. ✅ `SEC-TEST-123` should **NOT** appear anymore
3. This confirms soft-deleted shipments are filtered from customer queries!

---

## Troubleshooting

### Issue: "401 Unauthorized"
**Cause:** Token is missing, invalid, or expired

**Solutions:**
1. Check token is set: `echo $ADMIN_TOKEN`
2. Verify token format starts with `eyJ`
3. Get a fresh token from Auth0 dashboard
4. Check `AUTH0_AUDIENCE` matches in `.env` and Auth0 API settings

---

### Issue: "404 Customer not found"
**Cause:** Using invalid customer_id when creating shipment

**Solution:**
```bash
# Get valid customer IDs from seed data
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/admin/shipments | jq '.shipments[].customer_id' | sort -u
```

---

### Issue: "409 Conflict - Tracking number already exists"
**Cause:** Duplicate tracking number

**Solution:** Use unique tracking numbers:
```bash
# Generate unique tracking number with timestamp
TRACKING="TEST-$(date +%s)"
```

---

### Issue: Server not responding
**Solutions:**
```bash
# Check if server is running
curl http://localhost:8000/health

# Check Docker logs
docker-compose logs backend

# Restart server
make stop && make start
```

---

## Quick Reference

### All Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ No | Health check |
| GET | `/admin/shipments` | ✅ Yes | List shipments (with filters) |
| POST | `/admin/shipments` | ✅ Yes | Create shipment |
| PUT | `/admin/shipments/{id}` | ✅ Yes | Update shipment |
| DELETE | `/admin/shipments/{id}` | ✅ Yes | Soft-delete shipment |
| POST | `/admin/packages` | ✅ Yes | Add package |
| GET | `/admin/dashboard` | ✅ Yes | Dashboard stats |
| GET | `/admin/login` | ❌ No | Auth0 redirect (placeholder) |
| GET | `/admin/callback` | ❌ No | Auth0 callback (placeholder) |

---

## Recommended Testing Tools

**Easiest → Most Powerful:**

1. **Browser + Swagger UI** (`/docs`) - Best for beginners ⭐
2. **curl** - Universal, no installation needed
3. **HTTPie** - Prettier than curl, easy to use ⭐
4. **Postman** - GUI, great for complex workflows
5. **VS Code REST Client** - Test directly in editor ⭐
6. **Custom bash script** - Automation & CI/CD

---

**Happy Testing! 🚀**
