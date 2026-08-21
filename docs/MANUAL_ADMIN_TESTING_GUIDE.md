# Manual Testing Guide: Admin API Authorization (Week 4)

## Overview

This guide walks you through manual testing of the Admin API endpoints to verify that Auth0 JWT authentication is working correctly. You'll test both **rejection of unauthorized requests** and **successful operations with valid tokens**.

---

## Prerequisites

1. **Backend running**: `make start` (or `docker-compose up` from project root)
2. **Auth0 test account** configured (see `AUTH0_SETUP_GUIDE.md`)
3. **Browser** with developer tools (Chrome/Firefox recommended)
4. **Tool for API testing**: Choose one:
   - **Swagger UI** (built-in): http://localhost:8000/docs
   - **Postman** or **Insomnia**
   - **curl** command line

---

## Part 1: Test Without Authentication (Should Fail)

### Goal: Verify all admin endpoints return **401** without a valid token

### 1A. Using Swagger UI (Easiest)

1. Open http://localhost:8000/docs in your browser
2. Scroll to the **"admin"** section (green-tagged endpoints)
3. Try calling **GET /admin/shipments**:
   - Click "Try it out"
   - Click "Execute"
   - **Expected**: 401 response with `"detail": "Not authenticated"`

4. Try other admin endpoints the same way:
   - `GET /admin/dashboard`
   - `POST /admin/shipments` (provide any test data)
   
   **All should return 401** without authentication.

### 1B. Using curl (Terminal)

```bash
# Test GET /admin/shipments without token
curl -X GET "http://localhost:8000/admin/shipments" -v

# Expected response:
# HTTP/1.1 401 Unauthorized
# {"detail":"Not authenticated"}

# Test GET /admin/dashboard without token
curl -X GET "http://localhost:8000/admin/dashboard" -v

# Expected: Same 401 response

# Test POST /admin/shipments without token
curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "615bbe4a-2716-4322-8006-b5e2d759689f",
    "tracking_number": "TEST-MANUAL-001",
    "carrier": "FedEx",
    "origin": "NYC",
    "destination": "LA"
  }' -v

# Expected: 401 Unauthorized
```

### 1C. Using Browser Developer Console

1. Open http://localhost:8000/admin/shipments in your browser
2. You should see a JSON response: `{"detail":"Not authenticated"}`
3. Open Developer Tools (F12) → Network tab
4. Refresh the page
5. Look at the request:
   - **Status**: 401 Unauthorized
   - **Response**: `{"detail":"Not authenticated"}`

---

## Part 2: Get a Valid Auth0 Token

### Option A: Using Auth0 Test Token Generator (Fastest)

1. Go to your Auth0 Dashboard: https://manage.auth0.com
2. Navigate to **Applications** → Your app (e.g., "SecureShip Admin API")
3. Go to **Quick Start** tab → **Test** section
4. Click "Get Access Token" or use the test token provided
5. Copy the JWT token (starts with `eyJ...`)

### Option B: Using OAuth2 Flow (More realistic)

If you've set up Auth0 login in your app:

1. Navigate to http://localhost:3000/admin (frontend, if implemented)
2. You'll be redirected to Auth0 login
3. Log in with your test admin account
4. Open browser Developer Tools → Application/Storage → Cookies or Local Storage
5. Find the access token (usually stored as `access_token` or in a cookie)
6. Copy the token value

### Option C: Using Auth0's Get Token API (Manual)

```bash
# Replace these values with your Auth0 configuration
AUTH0_DOMAIN="your-tenant.auth0.com"
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"
AUDIENCE="https://secureship-api.example.com"

curl --request POST \
  --url "https://${AUTH0_DOMAIN}/oauth/token" \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "'"${CLIENT_ID}"'",
    "client_secret": "'"${CLIENT_SECRET}"'",
    "audience": "'"${AUDIENCE}"'",
    "grant_type": "client_credentials"
  }'

# Response will contain: {"access_token": "eyJ...", ...}
# Copy the access_token value
```

---

## Part 3: Test With Valid Token (Should Succeed)

**IMPORTANT**: Replace `YOUR_TOKEN_HERE` in all examples below with your actual JWT token from Part 2.

### 3A. Using Swagger UI

1. Open http://localhost:8000/docs
2. Click the **"Authorize"** button (top right, lock icon)
3. In the popup:
   - **Value**: `Bearer YOUR_TOKEN_HERE`
   - Click "Authorize"
   - Click "Close"
4. Now try admin endpoints again:
   - `GET /admin/dashboard` → Should return `200 OK` with stats
   - `GET /admin/shipments` → Should return `200 OK` with shipment list

### 3B. Using curl with Token

```bash
# Set your token as an environment variable for convenience
export TOKEN="YOUR_TOKEN_HERE"

# Test GET /admin/shipments
curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -v

# Expected: 200 OK with JSON shipment list

# Test GET /admin/dashboard
curl -X GET "http://localhost:8000/admin/dashboard" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with dashboard stats
```

---

## Part 4: Full CRUD Workflow

### Step 1: Get a Customer ID

First, we need a customer to create shipments for:

```bash
# Start a psql session to the database
docker exec -it secure-ship-ai-postgres-1 psql -U secureship -d secureship

# In psql:
SELECT id, first_name, last_name FROM customers LIMIT 5;

# Copy one of the customer UUIDs (e.g., 615bbe4a-2716-4322-8006-b5e2d759689f)
# Type \q to exit psql
```

### Step 2: Create a Shipment

```bash
export TOKEN="YOUR_TOKEN_HERE"
export CUSTOMER_ID="615bbe4a-2716-4322-8006-b5e2d759689f"  # Replace with real ID from Step 1

curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "'"$CUSTOMER_ID"'",
    "tracking_number": "MANUAL-TEST-'$(date +%s)'",
    "status": "label_created",
    "carrier": "FedEx",
    "origin": "San Francisco, CA",
    "destination": "New York, NY",
    "estimated_delivery": "2026-09-01T14:00:00Z"
  }'

# Expected: 201 Created
# Response will include the new shipment with an "id" field - save this!
```

**Save the shipment ID** from the response (e.g., `"id": "abcd1234-5678-..."`).

### Step 3: Update the Shipment

```bash
export SHIPMENT_ID="abcd1234-5678-..."  # Use the ID from Step 2

curl -X PUT "http://localhost:8000/admin/shipments/$SHIPMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_transit"
  }'

# Expected: 200 OK with updated shipment showing status: "in_transit"
```

### Step 4: Add a Package

```bash
curl -X POST "http://localhost:8000/admin/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "'"$SHIPMENT_ID"'",
    "description": "Manual Test Package",
    "weight_kg": 2.5,
    "declared_value": 150.00
  }'

# Expected: 201 Created with package details
```

### Step 5: Verify Customer Can See It

This tests the integration between admin CRUD and customer-facing tools.

**Option A: Using the chat interface (if frontend is running)**

1. Open http://localhost:3000
2. Verify your identity (use the same customer from Step 1)
3. Ask: "What shipments do I have?"
4. **Expected**: You should see the shipment you created in Step 2

**Option B: Direct database check**

```bash
docker exec -it secure-ship-ai-postgres-1 psql -U secureship -d secureship

# In psql:
SELECT tracking_number, status, carrier FROM shipments 
WHERE customer_id = '615bbe4a-2716-4322-8006-b5e2d759689f'  -- Your customer ID
AND deleted_at IS NULL;

# You should see your manually created shipment
```

### Step 6: Soft Delete the Shipment

```bash
curl -X DELETE "http://localhost:8000/admin/shipments/$SHIPMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -v

# Expected: 204 No Content (success with no body)
```

### Step 7: Verify Customer Can No Longer See It

**Critical security test**: Soft-deleted shipments must be invisible to customers.

```bash
# Check in database that deleted_at is set
docker exec -it secure-ship-ai-postgres-1 psql -U secureship -d secureship

# In psql:
SELECT tracking_number, status, deleted_at FROM shipments 
WHERE id = 'YOUR_SHIPMENT_ID';

# Expected: deleted_at should have a timestamp (not NULL)
```

**Then verify customer tools filter it out:**

1. If using frontend chat: Ask "What shipments do I have?" again
2. **Expected**: The deleted shipment should NOT appear in the list

**Or using curl to test the tool directly** (requires verified session):

```bash
# This tests the actual customer-facing tool logic
# Note: This is harder to test directly without a session, 
# so the frontend test is recommended here
```

---

## Part 5: Test Error Cases

### Test 1: Create Shipment for Non-Existent Customer

```bash
curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "00000000-0000-0000-0000-000000000000",
    "tracking_number": "TEST-ERROR-001",
    "carrier": "FedEx",
    "origin": "NYC",
    "destination": "LA"
  }'

# Expected: 404 Not Found
# Response: {"detail": "Customer ... not found"}
```

### Test 2: Duplicate Tracking Number

```bash
# First, create a shipment
curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "'"$CUSTOMER_ID"'",
    "tracking_number": "DUPLICATE-TEST",
    "carrier": "UPS",
    "origin": "LA",
    "destination": "SF"
  }'

# Expected: 201 Created

# Now try to create another shipment with the SAME tracking number
curl -X POST "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "'"$CUSTOMER_ID"'",
    "tracking_number": "DUPLICATE-TEST",
    "carrier": "FedEx",
    "origin": "NYC",
    "destination": "DC"
  }'

# Expected: 409 Conflict
# Response: {"detail": "Tracking number already exists"}
```

### Test 3: Update Non-Existent Shipment

```bash
curl -X PUT "http://localhost:8000/admin/shipments/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'

# Expected: 404 Not Found
# Response: {"detail": "Shipment ... not found"}
```

### Test 4: Expired Token

If you have an expired token (or can wait for one to expire):

```bash
export EXPIRED_TOKEN="eyJ..."  # Use an expired token

curl -X GET "http://localhost:8000/admin/shipments" \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  -v

# Expected: 401 Unauthorized
# Response: {"detail": "Token has expired"}
```

---

## Part 6: Verification Checklist

Mark each test as you complete it:

### Authorization Tests
- [ ] `GET /admin/shipments` without token returns **401**
- [ ] `POST /admin/shipments` without token returns **401**
- [ ] `PUT /admin/shipments/{id}` without token returns **401**
- [ ] `DELETE /admin/shipments/{id}` without token returns **401**
- [ ] `POST /admin/packages` without token returns **401**
- [ ] `GET /admin/dashboard` without token returns **401**
- [ ] All endpoints with **valid token** return **200/201**

### CRUD Operations
- [ ] Create shipment → Returns **201** with shipment details
- [ ] List shipments → Returns **200** with array of shipments
- [ ] Update shipment status → Returns **200** with updated shipment
- [ ] Add package to shipment → Returns **201** with package details
- [ ] Delete shipment → Returns **204** (no content)
- [ ] Dashboard stats → Returns **200** with counts and recent shipments

### Customer Isolation (Critical Security)
- [ ] Admin creates shipment → Customer **immediately sees** it via chat/tools
- [ ] Admin updates shipment → Customer sees **updated** data
- [ ] Admin soft-deletes shipment → Customer **no longer sees** it
- [ ] Soft-deleted shipment still exists in DB with `deleted_at` timestamp
- [ ] Admin can list deleted shipments with `include_deleted=true`

### Error Handling
- [ ] Create shipment for non-existent customer → **404**
- [ ] Duplicate tracking number → **409**
- [ ] Update non-existent shipment → **404**
- [ ] Expired token → **401**
- [ ] Malformed token → **401**

---

## Troubleshooting

### Issue: "Not authenticated" even with token

**Check**:
1. Token is in correct format: `Authorization: Bearer YOUR_TOKEN`
2. Token hasn't expired (check `exp` claim)
3. Token `aud` matches `AUTH0_AUDIENCE` in backend `.env`
4. Token `iss` matches `https://{AUTH0_DOMAIN}/`

**Debug**:
```bash
# Decode token to inspect claims (without verification)
# Visit: https://jwt.io and paste your token
# Or use:
echo "YOUR_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq
```

### Issue: JWKS fetch errors in logs

**Check**:
- Backend can reach `https://{AUTH0_DOMAIN}/.well-known/jwks.json`
- Test manually: `curl https://your-tenant.auth0.com/.well-known/jwks.json`

### Issue: Customer can still see deleted shipment

**Check**:
1. Database: `deleted_at` is actually set (not NULL)
2. Tools code: `tools.py` filters `deleted_at IS NULL`
3. Cache: No caching layer interfering (shouldn't be any in Week 4)

---

## Summary

By completing this guide, you've verified:

✅ **Admin endpoints are protected** — no access without valid Auth0 token  
✅ **CRUD operations work correctly** — create, read, update, soft-delete  
✅ **Customer isolation is maintained** — soft-deleted data invisible to customers  
✅ **Immediate visibility** — admin changes instantly visible to customers  
✅ **Error handling** — proper HTTP status codes for edge cases

This confirms **Week 4 Backend: Admin Endpoint Authorization** is complete and secure! 🎉

---

**Last Updated**: 2026-08-21  
**Related Docs**: `AUTH0_SETUP_GUIDE.md`, `docs/SOFT_DELETE_IMPLEMENTATION.md`
