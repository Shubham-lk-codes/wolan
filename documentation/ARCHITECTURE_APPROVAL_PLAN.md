# Wolan Logistics - Architecture Approval Plan

Status: Approved for implementation on 15 July 2026 by the application build request. The monorepo/shared foundation and core Phase 1 workflows are implemented; provider credentials and production Atlas/Redis resources remain environment-owned deployment inputs.

Source of truth: Wolan App Spec v2.0 (April 2026), supplemented by the requested MERN stack and the one-database constraint. Where the PDF specifies PostgreSQL, the approved project direction overrides it with MongoDB Atlas while preserving the functional requirements.

## 1. Overall architecture

Wolan will be a modular monorepo containing four deployable applications and one shared package:

- Admin React web application
- Admin Node/Express API
- Merchant Node/Express API, ready for a future React Native client
- Driver Node/Express API, ready for a future React Native client
- `@wolan/shared`, the only location for schemas, repositories, cross-platform business rules, validation primitives, permissions, events, and common infrastructure

All three APIs connect to the same named MongoDB Atlas database and therefore use the same collections. No service-specific database names or local MongoDB fallbacks will be permitted in production.

```text
Admin Web -> Admin API ----\
Merchant App -> Merchant API +--> one MongoDB Atlas database / shared collections
Driver App -> Driver API --/
                 |
                 +--> Redis (cache, BullMQ, Socket.io adapter)
                 +--> Cloudinary, Google Maps, Africa's Talking, Flutterwave
                 +--> package GPS provider (Traccar/device webhook integration)
```

The APIs remain separate deployable processes. Cross-service realtime messages use the Socket.io Redis adapter; database writes alone are not treated as a realtime transport. Reliable domain notifications use a transactional outbox plus BullMQ workers.

## 2. Target folder structure

```text
WOLAN/
|-- admin/
|   |-- frontend/
|   `-- backend/
|       `-- src/
|           |-- config/
|           |-- controllers/
|           |-- routes/
|           |-- sockets/
|           |-- jobs/
|           `-- app.js
|-- merchant-backend/
|   `-- src/
|       |-- config/
|       |-- controllers/
|       |-- routes/
|       |-- sockets/
|       `-- app.js
|-- driver-backend/
|   `-- src/
|       |-- config/
|       |-- controllers/
|       |-- routes/
|       |-- sockets/
|       `-- app.js
|-- shared/
|   |-- models/
|   |-- repositories/
|   |-- validation/
|   |-- constants/
|   |-- middleware/
|   |-- utils/
|   |-- services/
|   |-- permissions/
|   |-- events/
|   `-- package.json
|-- mongodb/
|   |-- indexes/
|   |-- migrations/
|   `-- seeds/
|-- documentation/
|   |-- architecture/
|   |-- api/
|   |-- deployment/
|   `-- runbooks/
|-- package.json
|-- docker-compose.yml
`-- .env.example
```

Planned source mapping:

- Current `frontend/` -> `admin/frontend/`
- Current `backend/` -> split by responsibility: admin code -> `admin/backend/`, merchant code -> `merchant-backend/`, duplicated schemas/business rules -> `shared/`
- Current `wolan merchant backend/backend/` -> merge its package metadata and documentation into `merchant-backend/`; it currently has no application source
- Current `wolan driver/` -> `driver-backend/`, with duplicated schemas and common logic extracted to `shared/`

The move will be performed only after approval, with file inventories before and after so no source is silently lost.

## 3. Database design

### One database rule

- One MongoDB Atlas cluster
- One explicitly named database: `wolan`
- One `MONGODB_URI` secret used by all three APIs
- Shared collection names controlled only by `@wolan/shared`
- Production startup fails if the database name is missing or differs from `wolan`
- Credentials remain in deployment secret stores and local `.env` files; committed examples contain placeholders only

### Mandatory base fields

Every persisted document uses a shared base schema:

```text
hubId       required, indexed; Hub documents use their own generated hub code
createdBy   actor User id or system actor
updatedBy   actor User id or system actor
createdAt   timestamp
updatedAt   timestamp
deletedAt   null until soft deleted; indexed
status      domain-specific enum; indexed
```

Global configuration records use the reserved tenant `HUB_GLOBAL`; application code never uses a missing `hubId`.

### Hub isolation

The authenticated token provides identity and role, but hub access is reloaded from the database for sensitive operations.

- Hub roles: `hubId = user.primaryHubId`
- Regional manager: `hubId in user.assignedHubIds`
- Director and super admin: all active hubs, optionally narrowed by an explicit hub filter
- Merchant: own `merchantId` and permitted hub
- Driver: own `driverId` and permitted hub

Controllers never build tenant filters. A shared scope resolver passes an immutable scope into repositories, and every repository combines it with `deletedAt: null`. Aggregations start with the same scope match. Direct model access from controllers is forbidden.

### Core relationships and indexes

- `users`: unique normalized phone/email as applicable; `{ hubId, role, status }`
- `hubs`: unique `hubId` and slug; geospatial location
- `merchants`: `{ hubId, userId }`, referral code, tier and COD settings
- `drivers`: `{ hubId, userId }`, availability, bond, vehicle, GPS device
- `orders`: unique order number; merchant, assigned driver, pickup/delivery, COD, lifecycle
- `packages`: unique package tracking id; order, GPS device, custody status
- `tracking`: time-series-compatible rider/package positions with `2dsphere` point indexes and retention policy
- `cod`: `{ hubId, driverId, status, businessDate }`
- `payments`: idempotency key, provider reference, order/merchant/driver relationship
- `notifications`: recipient and unread index
- `auditlogs`: actor, action, resource, before/after metadata; append-only

Important compound indexes include tenant first: `{ hubId, deletedAt, status, createdAt }`, `{ hubId, merchantId, createdAt }`, `{ hubId, driverId, status }`, and `{ hubId, orderNumber }`. Unique indexes use partial filters where soft deletion permits reuse. Index definitions live with shared schemas and are also documented under `mongodb/indexes/`.

### Transaction boundaries

MongoDB transactions are required for:

- order + package + initial custody + outbox event creation
- driver assignment/reassignment and capacity/COD checks
- tracker binding and custody transfer
- delivery completion, OTP consumption, proof of delivery, COD ledger, and audit event
- COD reconciliation and merchant payout batches
- inter-hub relay custody transfer in Phase 3

External provider calls occur outside database transactions and use idempotent outbox jobs.

## 4. Shared models

Required shared models:

- User
- Role
- Hub
- Merchant
- Driver
- Order
- Package
- Tracking
- Payment
- COD
- Notification
- Incident
- Rating
- OTP
- Setting
- Report
- Referral
- Vehicle
- GPSDevice
- Zone
- AuditLog
- Session

Additional models required by the PDF workflows:

- Customer
- DeliveryProof
- CustodyEvent
- DriverLocation
- PackageLocation
- FinePenalty
- DriverEarning
- Payout
- KYCDocument
- SecurityAlert
- SupportTicket
- RelayTransfer (Phase 3)
- OutboxEvent
- IdempotencyKey

There will be exactly one Mongoose model registration for each collection. Driver-, merchant-, and admin-specific view models are response DTOs, not additional MongoDB schemas.

## 5. API list

All APIs are versioned under `/api/v1`; the required audience prefixes follow immediately after it.

### Admin - `/api/v1/admin/*`

- Auth: login, refresh, logout, current session
- Dashboard: hub, regional, and HQ summaries; targets; live operations
- Hubs: create, list, detail, update, suspend, assign manager
- Users and roles: invite, list, update, deactivate, permissions
- Merchants: create, list, detail, KYC review, update, suspend
- Drivers: onboard, documents, bond, availability, performance, fines, tracker status
- Orders: create, list, detail, assign, auto-assign, reassign, batch, status, fail, return
- Packages and trackers: register, bind, scan history, custody, tamper, mismatch
- Live map: riders, packages, zones, delays, idle alerts
- COD: field exposure, reconciliation, settlement, rider limits
- Payments and payouts: list, reconcile, retry, provider webhook status
- Incidents and security alerts: list, investigate, classify liability, resolve
- Notifications: templates, send, list, acknowledge
- Reports: sales, drivers, COD, zones, customers, refunds, detailed export
- Settings, zones, uploads, audit logs, and operational health

### Merchant - `/api/v1/merchant/*`

- Auth: login, refresh, logout, forgot/reset credentials
- Profile and KYC
- Dashboard and tier/referral metrics
- Orders: create, list, detail, send-off, cancel where allowed
- Tracking: rider and package state for owned orders
- COD, payouts, payments, commission, and referral earnings
- Notifications and delivery receipts

### Driver - `/api/v1/driver/*`

- Auth: phone/PIN login, refresh, logout, PIN recovery/change
- Profile, status, GPS state, dashboard, performance, bond and fines
- Orders: available, assigned, current, accept, reject, pickup, scan, start, fail, return, complete
- Navigation and customer contact metadata
- Location update and heartbeat
- Package tracker scan/status/tamper reporting
- OTP verification and resend policy
- Incident reporting and photo upload
- Earnings, bonuses, COD carried, transactions, notifications

### Public - `/api/v1/public/*`

- QR/order tracking bootstrap with privacy-safe data
- Customer delivery rating submission
- Health/readiness endpoints without secrets

### Tracking - `/api/v1/tracking/*`

- Public token-based live rider/package tracking
- Authenticated device location ingestion
- Tracker heartbeat and tamper events
- Provider webhooks protected by signature, timestamp, and replay checks

List endpoints share pagination, search, filtering, and sorting contracts. Default pagination is cursor-based for live/high-volume data and page-based only where stable reporting requires it. Sort/filter fields are allowlisted.

## 6. Socket events

Canonical shared events:

- `orderCreated`
- `orderAssigned`
- `orderAccepted`
- `orderStatusChanged`
- `driverLocation`
- `packageLocation`
- `driverOffline`
- `packageMismatch`
- `newNotification`
- `orderDelivered`
- `OTPVerified`
- `trackerTampered`
- `incidentReported`
- `codLimitWarning`
- `dashboardUpdated`

Rooms: `hq`, `hub:{hubId}`, `role:{role}`, `merchant:{merchantId}`, `driver:{driverId}`, `order:{orderId}`, and `tracking:{publicToken}`. Socket authentication and authorization use the same RBAC and scope resolver as HTTP. Clients cannot self-join arbitrary hub or entity rooms.

## 7. Middleware

Shared middleware:

- request id and structured request context
- JWT access authentication and refresh-session validation
- RBAC permission authorization
- hub/region/HQ scope resolution
- merchant and driver ownership guards
- Zod request validation
- pagination/filter/sort normalization
- idempotency handling for mutating endpoints
- centralized response formatter
- centralized error handler and not-found handler
- audit context and mutation audit writer
- rate limiters by endpoint class and identity/IP
- upload validation
- webhook signature and replay protection
- security headers, CORS, compression, body size limits, and sanitized logging

## 8. Services

Shared domain services:

- AuthService and SessionService
- PermissionService and HubScopeService
- HubService
- MerchantService and ReferralService
- DriverService, AssignmentService, and PerformanceService
- OrderService, PricingService, DispatchService, ReturnService
- PackageService, TrackingService, CustodyService, MismatchDetectionService
- OTPService and DeliveryProofService
- CODService, PaymentService, PayoutService, ReconciliationService
- NotificationService, SMSService, EmailService, WhatsApp adapter
- MapsService, RouteService, ZoneService
- UploadService
- IncidentService and SecurityAlertService
- ReportService and ExportService
- AuditService
- OutboxService and JobService

Provider-specific code is behind interfaces so Cloudinary, Maps, GPS, payment, and messaging providers can be replaced without changing controllers or domain rules.

## 9. Controllers

Controllers remain platform-specific and thin:

- Admin controllers expose operational/HQ actions
- Merchant controllers expose merchant-owned actions
- Driver controllers expose driver-owned actions
- Public/tracking controllers expose privacy-restricted views and provider ingestion

Each controller validates input, obtains authorized scope, calls a shared service, and formats the result. It contains no Mongoose query, pricing rule, status-transition logic, or Socket.io emission.

## 10. Routes

Each backend owns only its platform route tree. Routes compose shared middleware and platform controllers. Route names are nouns, state changes use explicit action endpoints where they represent commands, and all error/status contracts are documented in OpenAPI. Internal integrations are authenticated service endpoints and never masquerade as admin routes.

## 11. Validation

Zod is the single validation library across APIs and compatible frontend forms. Shared schemas cover IDs, phone numbers, coordinates, money in integer UGX, dates, pagination, filters, order creation, status transitions, OTP, tracker samples, and webhook payloads. Business invariants that require database state remain in shared services. Unknown fields are rejected on writes.

## 12. Security

- Short-lived JWT access tokens plus rotating refresh sessions stored hashed
- Separate signing secrets/keys per environment; issuer and audience validation
- Permission-based RBAC for `SUPER_ADMIN`, `DIRECTOR`, `REGIONAL_MANAGER`, `HUB_MANAGER`, `OPS_COORDINATOR`, `MERCHANT`, and `DRIVER`
- Hub scope and entity ownership enforced server-side on every read and write
- Helmet, strict CORS allowlist, compression, Morgan-to-structured logger integration
- Rate limits for general API, authentication, OTP, tracking ingestion, uploads, and public tracking
- Password/PIN hashing, account lockout, session revocation, and token versioning
- Cloudinary type/size checks and signed delivery where documents are private
- Secrets redacted from logs; audit logs are append-only and exclude credentials/OTP values
- Mongo query/operator injection prevention and allowlisted sort/filter paths
- CSRF protection if refresh tokens use cookies; otherwise no browser token in local storage
- Webhook HMAC verification and idempotency/replay protection
- Dependency, container, and secret scanning in CI

The database password supplied in conversation should be rotated before production use because it has been disclosed outside a secret store.

## 13. Deployment strategy

- Deploy the admin frontend as a static Vite build behind a CDN
- Deploy three independent Node 20+ API containers with health/readiness checks
- Use MongoDB Atlas in a region selected for East Africa latency, one cluster and `wolan` database
- Use managed Redis for BullMQ, cache, distributed locks, and the Socket.io adapter
- Give each API its own least-privilege environment configuration while using the same Atlas database
- Run workers separately from web processes; scheduled COD/report jobs use distributed locks
- Use rolling deployments; backward-compatible database migrations run once in CI/CD
- Centralize JSON logs, metrics, traces, uptime alerts, queue monitoring, and Atlas alerts
- Back up with Atlas continuous backup and periodically test point-in-time restoration
- Environments: development, staging, production, each isolated; the one-database rule applies within each environment, never by sharing production with staging

Recommended implementation sequence after approval:

1. Snapshot/inventory current folders and establish the monorepo/workspaces.
2. Move applications into the approved paths without behavior changes.
3. Create `@wolan/shared`, base schema, role/permission model, tenant scope, errors, validation, and response contracts.
4. Consolidate duplicate models and make all APIs use the named Atlas database.
5. Restore and verify Admin API, then Merchant API, then Driver API compilation/tests.
6. Implement authentication, RBAC, and hub isolation tests before feature work.
7. Implement order/package/tracking/custody flows and cross-service realtime events.
8. Implement COD/payments, incidents/security, notifications, reports, and settings.
9. Complete integration, load, security, deployment, and recovery tests.

Every step must pass syntax checks, unit tests, integration tests, and hub-isolation tests before the next step begins.

## Pre-migration repository audit

- `backend/` currently starts as a Merchant API even though it also contains admin-oriented files.
- `backend/` mixes CommonJS and ES modules and has conflicting environment/database modules.
- `backend/` has no `package.json`, and its `.env.example` is empty.
- `wolan merchant backend/backend/` has package metadata and documentation but no `src/` application code.
- Admin models contain duplicate registrations such as upper/lowercase variants of Order, Merchant, Payment, Notification, and Referral.
- Driver has separate Driver, Order, Notification, OTP, and PackageTracker models instead of consuming shared collections through one shared schema package.
- Current API prefixes are mostly `/api/v1/*`, not the required platform-isolated `/api/v1/admin/*`, `/merchant/*`, `/driver/*`, `/public/*`, and `/tracking/*` contract.
- Current defaults point to different local database names, which violates the one-database rule.
- The admin frontend lacks several requested libraries, including React Query, Redux Toolkit, React Hook Form, and Zod.

These conflicts are migration inputs, not reasons to discard the existing work. Useful controllers, services, tests, and UI will be retained after classification.

## Implementation checkpoint - 15 July 2026

- Root npm workspaces now contain Admin Web, Admin API, Merchant API, Driver API, and `@wolan/shared`.
- All active platform controllers delegate persistence and business rules to shared portal/domain services.
- Shared models enforce the mandatory tenancy/audit fields and one model registration per active collection.
- The three APIs enforce the `wolan` database name and platform-isolated route prefixes.
- JWT access/refresh token types, rotating refresh sessions, hub scope, HMAC tracking webhooks, replay checks, and optional request idempotency are active.
- Order creation, package creation, handover verification, hub scan, driver assignment, status transitions, delivery proof, COD ledger, driver earning, audit, and outbox event boundaries use shared transactions where required.
- Admin Web consumes the versioned APIs, uses React Query/Redux Toolkit, and builds with the audited Vite 7 toolchain. Admin refresh sessions use HttpOnly SameSite cookies with CSRF validation; tokens are not persisted in local storage.
- Compose and Dockerfiles deploy the three APIs and Admin Web against environment-provided Atlas plus managed/local Redis; Compose does not create a fallback MongoDB.
- Executable migration, index, and development seed commands live under `mongodb/`.
- Syntax checks, unit/HTTP tests, production build, and production-dependency audit pass at this checkpoint.
- The post-migration cleanup removed the inactive root backend and duplicate platform-specific model stacks; the repository now contains only the approved active workspaces and shared persistence layer.
