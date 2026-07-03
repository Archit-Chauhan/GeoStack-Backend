# GeoStock — Backend API

REST + real-time backend for **GeoStock**, a map-centric Supply Chain Management (SCM)
platform. Built with **Node.js, Express, MongoDB/Mongoose, JWT, Socket.IO and Zod**.

- **Live API:** https://geostack-backend.onrender.com
- **Health check:** https://geostack-backend.onrender.com/api/v1/health
- **Frontend repo:** https://github.com/Archit-Chauhan/GeoStack (live at https://geo-stack-five.vercel.app)

---

## Table of contents
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Data models](#data-models)
- [Roles & permissions (RBAC)](#roles--permissions-rbac)
- [REST API](#rest-api)
- [Real-time (Socket.IO)](#real-time-socketio)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment (Render)](#deployment-render)

---

## Tech stack

| Concern | Choice |
|---|---|
| Runtime / framework | Node.js 18+, Express 4 |
| Database | MongoDB Atlas + Mongoose 8 |
| Auth | JWT access tokens + rotating refresh tokens (httpOnly cookie), bcrypt |
| Validation | Zod (per-route schemas) |
| Real-time | Socket.IO 4 (JWT handshake, room-based) |
| Security | helmet, CORS (credentialed), express-rate-limit |
| Testing | Jest + Supertest + mongodb-memory-server (offline) |

---

## Architecture

The API is a clean, **layered, multi-tenant** service.

- **Multi-tenancy** — every document (except `Company`) carries a `company` reference, and
  **every query is scoped to the caller's company**, so tenants are fully isolated.
- **Layered modules** — each feature is a self-contained module with an identical shape:
  ```
  <name>.routes.js       # express router: auth + RBAC + validation wiring
  <name>.controller.js   # thin — parses req, calls service, sends response
  <name>.service.js      # ALL business logic + DB access (never touches req/res)
  <name>.validation.js   # Zod schemas consumed by the validate middleware
  ```
- **Auth flow** — `register`/`login` issue a short-lived **access JWT** (15m, sent as
  `Authorization: Bearer`) and a **refresh token** (7d) stored hashed in the DB and set as an
  httpOnly cookie. `POST /auth/refresh` rotates the refresh token and returns a new access token.
- **RBAC** — a permission middleware guards every mutating route; 9 roles map to permission
  strings (see below). Services additionally enforce location scope.
- **Real-time** — inventory/transfer/sale/notification changes emit Socket.IO events to the
  relevant company/warehouse/store rooms.
- **Audit** — every important mutation writes an `AuditLog` (actor, action, before/after, ip).
- **Uniform responses** — success `{ success, message, data }`; errors
  `{ success, message, errors? }` with correct HTTP status via a central error handler.

---

## Folder structure

```
server/
├─ src/
│  ├─ server.js            # http + Socket.IO bootstrap (connects DB, then listens)
│  ├─ app.js               # express app (helmet, cors, cookies, /api/v1, error handling)
│  ├─ config/              # env-driven config (no hardcoded secrets)
│  ├─ db/connect.js        # mongoose connection
│  ├─ socket/              # Socket.IO init (JWT handshake) + emit helpers
│  ├─ constants/roles.js   # ROLES, ROLE_HIERARCHY, PERMISSIONS, ROLE_PERMISSIONS
│  ├─ middleware/          # authenticate, authorize, validate, error
│  ├─ utils/               # ApiError, ApiResponse, asyncHandler, tokens, audit, geo, code
│  ├─ models/              # Mongoose models (the data contract)
│  ├─ modules/             # auth, company, users, roles, warehouses, stores, products,
│  │                       #   inventory, transfers, sales, analytics, notifications, audit
│  ├─ routes/index.js      # mounts every module under /api/v1
│  └─ seed/seed.js         # demo data seed (Northwind Supply Co.)
└─ tests/                  # jest + supertest against in-memory MongoDB
```

---

## Data models

`Company`, `User`, `RefreshToken`, `Warehouse`, `Store`, `Product`, `Inventory`, `Transfer`,
`Sale`, `Notification`, `AuditLog`.

Highlights:
- **Inventory** — one record per `(product, location)`; tracks `available / reserved / incoming /
  outgoing / damaged`.
- **Transfer** — a state machine (`requested → approved → dispatched → in_transit → delivered →
  received`, `+ cancelled`) with a `timeline`, and `distanceKm`/`etaHours` computed from the
  source/destination coordinates.
- **Sale** — reduces store stock atomically; totals are computed server-side.

---

## Roles & permissions (RBAC)

Nine roles across a company → warehouse/store hierarchy, plus a read-only analyst:

| Role | Scope |
|---|---|
| `company_owner`, `company_admin` | full control |
| `warehouse_manager` / `warehouse_staff` / `warehouse_helper` | warehouse ops |
| `store_manager` / `cashier` / `store_helper` | store ops & sales |
| `analyst` | **read-only** across everything |

Permissions are `resource:action` strings (e.g. `inventory:adjust`, `transfers:approve`).
`authorize(...perms)` returns **403** unless the caller's role grants every listed permission.

---

## REST API

Base path: **`/api/v1`**. Auth via `Authorization: Bearer <accessToken>`.

| Module | Endpoints |
|---|---|
| **auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PATCH /auth/me` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| **company** | `GET /company` · `PATCH /company` |
| **users** | `GET /users` · `POST /users/invite` · `GET/PATCH/DELETE /users/:id` · `PATCH /users/:id/role` |
| **roles** | `GET /roles` (roles + permission matrix) |
| **warehouses** | `GET/POST /warehouses` · `GET/PATCH/DELETE /warehouses/:id` · `GET /warehouses/:id/summary` |
| **stores** | `GET/POST /stores` · `GET/PATCH/DELETE /stores/:id` · `GET /stores/:id/summary` |
| **products** | `GET/POST /products` · `GET/PATCH/DELETE /products/:id` |
| **inventory** | `GET /inventory` · `GET /inventory/low-stock` · `POST /inventory/adjust` |
| **transfers** | `GET/POST /transfers` · `GET /transfers/:id` · `POST /transfers/:id/{approve,dispatch,in-transit,deliver,receive,cancel}` |
| **sales** | `GET/POST /sales` · `GET /sales/:id` · `POST /sales/:id/refund` |
| **analytics** | `GET /analytics/{overview,throughput,stock-by-category,low-stock,fast-moving}` |
| **notifications** | `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` |
| **audit** | `GET /audit` |

List endpoints support `?page&limit&sort&q` and return `{ items, page, limit, total, pages }`.

---

## Real-time (Socket.IO)

Clients connect with `auth: { token: <accessToken> }`; the server verifies the JWT on the
handshake and joins `company:<id>` (plus `warehouse:<id>` / `store:<id>` when scoped).

**Server → client events:** `inventory:updated`, `transfer:created`, `transfer:updated`,
`sale:created`, `notification:new`, `dashboard:update`.

---

## Environment variables

Copy `.env.example` → `.env` and fill in. **Never commit `.env`.**

| Key | Description |
|---|---|
| `PORT` | API port (default 5000) |
| `NODE_ENV` | `development` / `production` |
| `MONGO_URI` | MongoDB connection string (`mongodb+srv://…/geostock`) |
| `CLIENT_URL` | Allowed browser origin for CORS + cookies |
| `JWT_ACCESS_SECRET` | random secret for access tokens |
| `JWT_REFRESH_SECRET` | **different** random secret for refresh tokens |
| `COOKIE_SECRET` | random secret for cookie signing |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | token lifetimes (`15m` / `7d`) |

Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

> In `production` the API **refuses to boot** if any JWT/cookie secret is left at a dev default.

---

## Local development

```bash
npm install
cp .env.example .env         # then set MONGO_URI + secrets
npm run seed                 # optional: demo data (owner@northwind.co / Demo1234!)
npm run dev                  # nodemon on http://localhost:5000
```

## Testing

```bash
npm test                     # jest + supertest, runs against an in-memory MongoDB (no DB needed)
```
Covers auth, RBAC + tenant isolation, inventory adjust + audit, and the full transfer state machine.

## Deployment (Render)

- **Type:** Web Service · **Root Directory:** blank · **Build:** `npm install` · **Start:** `npm start`
- **Health Check Path:** `/api/v1/health`
- Set all env vars above (with `NODE_ENV=production` and `CLIENT_URL` = the frontend origin).

Deployed at **https://geostack-backend.onrender.com**.
