# Admin Panel Setup Guide

## Overview

The SecureShip admin panel allows staff to manage shipments and packages through a web interface. All admin endpoints are protected by Auth0 JWT verification.

## Quick Start (Testing Mode)

For Week 4 manual testing, you can use a simplified token-based authentication:

### 1. Get an Auth0 Test Token

1. Log into your Auth0 Dashboard
2. Navigate to **Applications** → **APIs** → Select your API
3. Go to the **Test** tab
4. Copy the test **Access Token** (the long JWT string)

### 2. Start the Application

```bash
# From project root
make start
```

This will start:
- Backend API on `http://localhost:8000`
- Frontend on `http://localhost:3000`
- PostgreSQL database

### 3. Access Admin Panel

1. Open `http://localhost:3000/admin`
2. Paste your Auth0 access token into the text area
3. Click "Login with Token"
4. You'll be redirected to `http://localhost:3000/admin/dashboard`

## Admin Panel Features

### Dashboard
- **Statistics Cards**: Total shipments, by status counts
- **Shipment List**: Paginated table of all shipments
- **Filters**: Filter by status (label_created, in_transit, etc.)
- **Quick Actions**: Update status, delete shipment

### Create Shipment
1. Click "Create Shipment" button
2. Fill in the form:
   - Customer ID (must exist in database - get from `make seed`)
   - Tracking Number (unique)
   - Carrier (e.g., FedEx, UPS, USPS)
   - Origin and Destination
   - Status
   - Estimated Delivery (optional)
3. Click "Create Shipment"

### Update Shipment
- Change status directly from the dropdown in the table
- Status updates are applied immediately

### Delete Shipment (Soft Delete)
- Click "Delete" on any shipment
- Confirm the action
- The shipment is soft-deleted (sets `deleted_at` timestamp)
- Customer-facing queries will no longer return this shipment

## Production Setup (Auth0 Universal Login)

For production deployment with full Auth0 integration:

### 1. Configure Auth0

Create an Auth0 Application (Single Page Application):

1. Go to Auth0 Dashboard → Applications → Create Application
2. Choose "Single Page Application"
3. Note your:
   - Domain (e.g., `your-tenant.auth0.com`)
   - Client ID
   - Configure Allowed Callback URLs: `http://localhost:3000/admin/callback`
   - Configure Allowed Logout URLs: `http://localhost:3000/admin`
   - Configure Allowed Web Origins: `http://localhost:3000`

### 2. Configure Auth0 API

1. Go to Auth0 Dashboard → Applications → APIs
2. Create or select your API
3. Note the API Identifier (this is your Audience)

### 3. Set Environment Variables

**Frontend** (`frontend/.env`):
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your_spa_client_id
NEXT_PUBLIC_AUTH0_AUDIENCE=your_api_identifier
```

**Backend** (`backend/.env`):
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_api_client_id
AUTH0_CLIENT_SECRET=your_api_client_secret
AUTH0_AUDIENCE=your_api_identifier
```

### 4. Install Auth0 SDK (Optional - for full integration)

```bash
cd frontend
npm install @auth0/nextjs-auth0
```

Then replace the manual token auth with proper Auth0 SDK integration.

## Testing the Admin Panel

### Manual Test Script

1. **Login Test**
   ```
   Visit: http://localhost:3000/admin
   Expected: Login page
   Action: Paste valid Auth0 token
   Expected: Redirect to dashboard
   ```

2. **Dashboard Load Test**
   ```
   Expected: Stats cards show shipment counts
   Expected: Table shows shipment list
   Expected: No 401 errors in console
   ```

3. **Create Shipment Test**
   ```
   Action: Click "Create Shipment"
   Action: Fill form with valid customer_id (from `make seed`)
   Action: Submit
   Expected: New shipment appears in table
   Expected: Customer can see it via chat (test in separate browser)
   ```

4. **Update Status Test**
   ```
   Action: Change status dropdown on any shipment
   Expected: Status updates immediately
   Expected: Customer sees updated status in chat
   ```

5. **Soft Delete Test**
   ```
   Action: Click "Delete" on a shipment
   Action: Confirm
   Expected: Shipment disappears from admin list
   Expected: Customer can no longer see it in chat
   Expected: Database row still exists with deleted_at set
   ```

6. **Auth Test**
   ```
   Action: Remove token from localStorage
   Action: Refresh page or visit /admin/dashboard
   Expected: Redirect to /admin login page
   ```

   ```
   Action: Use invalid/expired token
   Expected: API returns 401
   Expected: Redirect to login
   ```

## API Endpoints Used

All endpoints require `Authorization: Bearer <token>` header:

- `GET /admin/shipments` - List shipments (with filters)
- `POST /admin/shipments` - Create shipment
- `PUT /admin/shipments/{id}` - Update shipment
- `DELETE /admin/shipments/{id}` - Soft-delete shipment
- `POST /admin/packages` - Add package to shipment
- `GET /admin/dashboard` - Get summary statistics

## Troubleshooting

### "401 Unauthorized" on all requests
- Check that your Auth0 token is valid and not expired
- Verify `AUTH0_AUDIENCE` matches between frontend and backend config
- Check backend logs for JWT verification errors

### "Customer not found" when creating shipment
- Run `make seed` to populate test customers
- Get a valid customer_id from the database:
  ```sql
  SELECT id, phone_number FROM customers LIMIT 5;
  ```

### "No access token received from Auth0"
- Check Auth0 callback URL is configured correctly
- Verify Auth0 application settings (Allowed Callback URLs)
- Check browser console for errors

### Frontend 404 on /admin
- Ensure frontend dev server is running
- Check that files exist:
  - `frontend/src/pages/admin/index.tsx`
  - `frontend/src/pages/admin/dashboard.tsx`
  - `frontend/src/pages/admin/callback.tsx`

## Security Notes

⚠️ **Important**: The current implementation stores tokens in `localStorage` for testing convenience. In production:

1. Use HTTP-only cookies for token storage
2. Implement proper CSRF protection
3. Use Auth0's SDK for secure session management
4. Never commit `.env` files with real credentials
5. Rotate Auth0 secrets regularly
6. Monitor failed authentication attempts

## Architecture Notes

### Trust Boundaries

The admin panel operates on a **separate trust boundary** from customer-facing features:

- **Customer Auth**: Session-based, verified by `session.customer_id` in `tools.py`
- **Admin Auth**: JWT-based, verified by `require_admin()` dependency in `admin.py`

These are **completely independent** — a verified customer session cannot access admin endpoints, and vice versa.

### Soft Delete Implementation

When an admin deletes a shipment:
1. Backend sets `deleted_at = NOW()` on the shipment row
2. Customer-facing queries in `tools.py` filter `WHERE deleted_at IS NULL`
3. Admin queries support `include_deleted=true` parameter to see deleted items
4. The row is never hard-deleted, preserving audit trail and FK relationships

## Next Steps

- [ ] Implement full Auth0 SDK integration (replace manual token entry)
- [ ] Add package management UI (view/add packages to shipments)
- [ ] Add bulk operations (mark multiple as delivered)
- [ ] Add shipment edit page (detailed form)
- [ ] Add customer search/management
- [ ] Add audit log viewer
- [ ] Add export functionality (CSV/Excel)
