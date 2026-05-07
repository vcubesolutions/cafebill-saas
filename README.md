# ☕ CafeBill SaaS Platform

A subscription-based billing software platform for restaurants and cafes.

## Project Structure

```
cafe-billing-saas/
├── landing/index.html     ← Marketing website (pricing, signup form)
├── admin/index.html       ← Super admin dashboard (manage tenants)
└── backend/
    ├── app.js             ← Main Express server
    ├── .env               ← Config (port, admin credentials)
    ├── db/
    │   ├── masterDb.js    ← Master DB (tenants, signup requests)
    │   ├── tenantDb.js    ← Per-tenant DB factory
    │   └── data/
    │       ├── master.db  ← Created automatically on first run
    │       └── tenants/
    │           └── *.db   ← One DB file per cafe (created on activation)
    ├── middleware/
    │   └── tenant.js      ← Resolves tenant from subdomain
    └── routes/
        ├── public.js      ← Signup API (landing page)
        ├── admin.js       ← Admin dashboard API
        └── tenant.js      ← All billing routes (items/orders/staff/etc)
```

## Quick Start

```bash
cd backend
npm install
node app.js
```

Then open:
- Landing page: http://localhost:5000
- Admin panel:  http://localhost:5000/admin  (admin / cafebill@admin2025)

## Plans

| Plan     | Price     | Staff | Items | Branches |
|----------|-----------|-------|-------|----------|
| Basic    | ₹299/mo   | 2     | 30    | 1        |
| Pro      | ₹699/mo   | 10    | ∞     | 3        |
| Business | ₹1499/mo  | ∞     | ∞     | ∞        |

## How Tenants Work

1. Restaurant owner fills the signup form on the landing page
2. Admin reviews the request in the Admin panel
3. Admin clicks "Activate" and assigns a subdomain (e.g. `brewhousehyd`)
4. Tenant is created at `brewhousehyd.cafebill.in`
5. Each tenant has their own isolated SQLite database

## Development: Testing a Tenant

Since subdomains don't work on localhost, use the `?tenant=` query param or `X-Tenant-ID` header:

```
http://localhost:5000/api/items?tenant=brewhousehyd
```

Or in code:
```js
fetch('http://localhost:5000/api/items', {
  headers: { 'X-Tenant-ID': 'brewhousehyd' }
})
```

## Production Deployment (Render)

1. Deploy backend to Render as a Web Service
2. Add environment variables from `.env`
3. Set your domain to `cafebill.in` with wildcard DNS `*.cafebill.in → your server`
4. Update `BASE_DOMAIN` in `.env` to `cafebill.in`

## Admin Credentials

Default: `admin` / `cafebill@admin2025`
Change in `.env`: `ADMIN_PASSWORD=yourpassword`
