# Auth0 Setup Guide - Getting Your Admin API Credentials

This guide walks you through creating an Auth0 account and getting the required environment variables for admin API authentication.

---

## 🎯 Quick Summary

You need these 4 values for your `.env` file:
- `AUTH0_DOMAIN` - Your Auth0 tenant domain
- `AUTH0_CLIENT_ID` - Machine-to-machine app client ID
- `AUTH0_CLIENT_SECRET` - Machine-to-machine app secret
- `AUTH0_AUDIENCE` - Your API identifier

---

## Step 1: Create Auth0 Account (Free)

1. **Go to Auth0:** https://auth0.com/signup
2. **Sign up** with your email/GitHub/Google
3. **Choose tenant domain:** `your-project-name` (e.g., `secureship-dev`)
   - This becomes: `your-project-name.us.auth0.com`
   - ⚠️ **Remember this!** This is your `AUTH0_DOMAIN`
4. **Select region:** Choose closest to you (US, EU, AU, etc.)
5. **Complete signup**

---

## Step 2: Create an API (Your Backend)

1. **In Auth0 Dashboard, go to:** **Applications** → **APIs**
2. **Click:** "+ Create API"
3. **Fill in:**
   - **Name:** `SecureShip Admin API`
   - **Identifier:** `https://api.secureship.local` 
     - ⚠️ **This is your `AUTH0_AUDIENCE`**
     - Can be any URL format, doesn't need to be a real domain
     - Just needs to be unique in your tenant
   - **Signing Algorithm:** `RS256` (default)
4. **Click:** "Create"

**✅ You now have: `AUTH0_AUDIENCE`**

---

## Step 3: Create Machine-to-Machine Application

This is the application that will authenticate to your API (used for testing and admin tools).

1. **Go to:** **Applications** → **Applications**
2. **Click:** "+ Create Application"
3. **Fill in:**
   - **Name:** `SecureShip Admin M2M`
   - **Type:** Select **"Machine to Machine Applications"**
4. **Click:** "Create"
5. **Select authorized API:**
   - Choose: `SecureShip Admin API` (the one you just created)
6. **Select permissions:**
   - For now, just click "Authorize" (you can configure scopes later)

---

## Step 4: Get Your Credentials

### 4.1 Get CLIENT_ID and CLIENT_SECRET

1. **After creating the M2M app, you'll see the "Quick Start" tab**
2. **Or go to:** **Settings** tab
3. **Copy these values:**
   - **Domain:** `your-project-name.us.auth0.com` → `AUTH0_DOMAIN`
   - **Client ID:** `abc123...` → `AUTH0_CLIENT_ID`
   - **Client Secret:** `xyz789...` → `AUTH0_CLIENT_SECRET`

⚠️ **Security Note:** Never commit the Client Secret to git! Keep it in `.env` (which should be in `.gitignore`)

### 4.2 Verify Your API Identifier

1. **Go to:** **Applications** → **APIs**
2. **Click on:** "SecureShip Admin API"
3. **Copy the "Identifier"** → This is your `AUTH0_AUDIENCE`

---

## Step 5: Update Your .env File

Edit `backend/.env`:

```bash
# Admin Auth
AUTH0_DOMAIN=your-project-name.us.auth0.com
AUTH0_CLIENT_ID=abc123def456ghi789
AUTH0_CLIENT_SECRET=xyz789abc123def456ghi789jkl012mno345pqr678stu901vwx234
AUTH0_AUDIENCE=https://api.secureship.local
```

**Example with real format:**
```bash
AUTH0_DOMAIN=secureship-dev.us.auth0.com
AUTH0_CLIENT_ID=aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
AUTH0_CLIENT_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890aBcDeFgHiJkLmNoPqRsTuVwXyZ
AUTH0_AUDIENCE=https://api.secureship.local
```

---

## Step 6: Get a Test Token

Now that you have your credentials, here's how to get a token for testing:

### Option A: Using Auth0 Dashboard (Easiest!)

1. **Go to:** **Applications** → **APIs** → **SecureShip Admin API**
2. **Click:** "Test" tab
3. **You'll see a curl command** like:
   ```bash
   curl --request POST \
     --url https://your-project-name.us.auth0.com/oauth/token \
     --header 'content-type: application/json' \
     --data '{"client_id":"...","client_secret":"...","audience":"...","grant_type":"client_credentials"}'
   ```
4. **Copy and run it in your terminal**
5. **Copy the `access_token` from the response**

### Option B: Using curl with Your .env Values

```bash
# Source your .env file
source backend/.env

# Request token
curl --request POST \
  --url "https://$AUTH0_DOMAIN/oauth/token" \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "'$AUTH0_CLIENT_ID'",
    "client_secret": "'$AUTH0_CLIENT_SECRET'",
    "audience": "'$AUTH0_AUDIENCE'",
    "grant_type": "client_credentials"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ij...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### Option C: Create a Helper Script

Create `backend/get-token.sh`:

```bash
#!/bin/bash
# Load .env file
set -a
source .env
set +a

# Get token
RESPONSE=$(curl -s --request POST \
  --url "https://$AUTH0_DOMAIN/oauth/token" \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "'$AUTH0_CLIENT_ID'",
    "client_secret": "'$AUTH0_CLIENT_SECRET'",
    "audience": "'$AUTH0_AUDIENCE'",
    "grant_type": "client_credentials"
  }')

# Extract and export token
export ADMIN_TOKEN=$(echo $RESPONSE | jq -r '.access_token')

if [ "$ADMIN_TOKEN" != "null" ]; then
  echo "✅ Token obtained successfully!"
  echo "Token expires in: $(echo $RESPONSE | jq -r '.expires_in') seconds"
  echo ""
  echo "Token has been exported as \$ADMIN_TOKEN"
  echo "You can now run: curl -H \"Authorization: Bearer \$ADMIN_TOKEN\" http://localhost:8000/admin/shipments"
  echo ""
  echo "Or copy it:"
  echo "$ADMIN_TOKEN"
else
  echo "❌ Failed to get token"
  echo "$RESPONSE" | jq
fi
```

**Make it executable and run:**
```bash
chmod +x backend/get-token.sh
source backend/get-token.sh  # Use 'source' to export ADMIN_TOKEN to your shell
```

---

## Step 7: Test Your Setup

### 7.1 Verify Backend Can Validate Tokens

```bash
# Start backend
cd backend
make start

# In another terminal, get token
source get-token.sh

# Test authenticated endpoint
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/admin/dashboard
```

**Expected:** JSON response with dashboard stats ✅

**If you get 401:** Check your `.env` values match Auth0 dashboard

### 7.2 Verify Token Rejection Works

```bash
# No token - should fail
curl http://localhost:8000/admin/shipments

# Invalid token - should fail
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:8000/admin/shipments
```

**Expected:** `401 Unauthorized` ✅

---

## Common Issues & Solutions

### Issue: "Invalid token" / 401 even with valid credentials

**Cause:** `AUTH0_AUDIENCE` mismatch

**Solution:**
1. Check API Identifier in Auth0 dashboard matches `.env`
2. Ensure you're getting token for the correct audience:
   ```bash
   # In your token request, verify this matches:
   "audience": "https://api.secureship.local"
   ```

---

### Issue: "jwks_uri not configured"

**Cause:** `AUTH0_DOMAIN` missing or wrong format

**Solution:**
```bash
# ✅ Correct format:
AUTH0_DOMAIN=your-tenant.us.auth0.com

# ❌ Wrong (don't include https://):
AUTH0_DOMAIN=https://your-tenant.us.auth0.com

# ❌ Wrong (don't include /):
AUTH0_DOMAIN=your-tenant.us.auth0.com/
```

---

### Issue: "Client authentication failed"

**Cause:** Wrong `AUTH0_CLIENT_ID` or `AUTH0_CLIENT_SECRET`

**Solution:**
1. Go to Auth0 Dashboard → Applications → Your M2M App
2. Copy fresh credentials from Settings tab
3. Make sure there are no extra spaces or quotes in `.env`

---

### Issue: Token works but expires quickly

**Normal behavior!** Tokens typically expire in 24 hours (86400 seconds).

**For development:**
1. Go to Auth0 Dashboard → Applications → APIs → Your API → Settings
2. Under "Token Settings", adjust "Token Expiration" (default is 86400 seconds)
3. Max is 2,592,000 seconds (30 days)

**For production:** Short-lived tokens are more secure. Implement refresh tokens if needed.

---

## Understanding the Token

Your JWT token has three parts (separated by `.`):

```
eyJhbGciOiJSUzI1NiI...  .  eyJpc3MiOiJodHRwc...  .  signature
     [HEADER]            .      [PAYLOAD]        .  [SIGNATURE]
```

**Decode it at:** https://jwt.io

**You'll see:**
```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "abc123@clients",
  "aud": "https://api.secureship.local",
  "exp": 1724354400,
  "iat": 1724268000
}
```

- `iss` (issuer): Your Auth0 domain
- `aud` (audience): Your API identifier
- `exp` (expiration): Unix timestamp
- `sub` (subject): Your M2M application ID

**Your backend validates all of these!** ✅

---

## Alternative: Skip Auth for Local Development (Not Recommended)

If you want to test without setting up Auth0 (⚠️ **temporary only!**):

**Option 1: Mock the dependency**

Edit `backend/src/secureship/admin.py`:

```python
# At the top of the file, add:
import os

# Replace require_admin dependency with this:
def mock_require_admin():
    """Mock admin auth for local testing - REMOVE IN PRODUCTION!"""
    if os.getenv("SKIP_AUTH", "false").lower() == "true":
        return {"sub": "test-admin", "mock": True}
    return require_admin()

# Then in all endpoint signatures, change:
# _admin: dict[str, Any] = Depends(require_admin)
# TO:
# _admin: dict[str, Any] = Depends(mock_require_admin)
```

**In `.env`:**
```bash
SKIP_AUTH=true  # ⚠️ DEVELOPMENT ONLY - NEVER COMMIT THIS!
```

**⚠️ CRITICAL:** Remove this before committing or deploying!

---

## Auth0 Free Plan Limits

**Good news:** The free tier is generous for development:

- ✅ **7,000 active users** (more than enough for admin users)
- ✅ **Unlimited logins**
- ✅ **M2M tokens:** Unlimited for development
- ✅ **APIs:** Up to 5
- ✅ **Applications:** Unlimited
- ✅ **Social connections:** Google, GitHub, etc.

**You won't hit limits during development!**

---

## Next Steps After Setup

### 1. Test All Endpoints
Follow the `MANUAL_TESTING_GUIDE.md` with your real token.

### 2. Add More Admin Users (Optional)
For a real admin panel with user login:
1. Create a **Regular Web Application** in Auth0 (not M2M)
2. Configure callback URLs for your frontend
3. Install `@auth0/nextjs-auth0` in frontend (Week 4 frontend task)
4. Implement login UI

### 3. Configure Authorization (Optional - Advanced)
For role-based access (e.g., admin vs. read-only):
1. Enable **Role-Based Access Control (RBAC)** in API settings
2. Create roles: `admin`, `viewer`, etc.
3. Add permissions: `create:shipments`, `read:shipments`, etc.
4. Check permissions in your backend endpoints

---

## Quick Reference Card

```bash
# ========================================
# Auth0 Credentials Checklist
# ========================================

# 1. Your Auth0 Tenant
AUTH0_DOMAIN=__________.us.auth0.com
   └─ Get from: Dashboard → Applications → Settings

# 2. Your API Identifier  
AUTH0_AUDIENCE=https://api.__________.local
   └─ Get from: Dashboard → APIs → Your API → Settings

# 3. Your M2M Application
AUTH0_CLIENT_ID=____________________________
AUTH0_CLIENT_SECRET=____________________________
   └─ Get from: Dashboard → Applications → Your M2M App → Settings

# ========================================
# Get Token Command
# ========================================
curl --request POST \
  --url https://YOUR_DOMAIN/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "YOUR_AUDIENCE",
    "grant_type": "client_credentials"
  }'

# ========================================
# Test Command
# ========================================
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/admin/dashboard
```

---

## Resources

- **Auth0 Documentation:** https://auth0.com/docs
- **M2M Authentication Guide:** https://auth0.com/docs/get-started/authentication-and-authorization-flow/client-credentials-flow
- **JWT Debugger:** https://jwt.io
- **Auth0 Community:** https://community.auth0.com

---

**Need Help?** 

If you get stuck:
1. Check the error message in backend logs: `docker-compose logs backend`
2. Verify your `.env` values match Auth0 dashboard exactly
3. Decode your token at jwt.io and verify `aud` matches `AUTH0_AUDIENCE`
4. Try the "Skip Auth" option temporarily to isolate the issue

---

**Ready to go! 🚀**

Once your `.env` is configured and you have a token, you can test all admin endpoints using the `MANUAL_TESTING_GUIDE.md`.
