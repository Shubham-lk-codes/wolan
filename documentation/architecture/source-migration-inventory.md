# Source migration inventory

## Active deployable workspaces

- `admin/frontend` — Admin React application
- `admin/backend` — Admin, Public, and Tracking APIs
- `merchant-backend` — Merchant API
- `driver-backend` — Driver API
- `shared` — canonical models, repositories, validation, permissions, middleware, events, and domain services

The root `package.json` is the authoritative workspace list. Every backend loads the same ignored root `.env`, uses `MONGODB_DB_NAME=wolan`, and registers persistence models only through `@wolan/shared`.

## Cleanup result

- Removed the original mixed root `backend/` migration copy.
- Removed duplicate Admin and Driver models, controllers, routes, middleware, repositories, validators, services, and provider-specific legacy stacks.
- Retained one platform controller and one route tree per API.
- Normalized realtime code under each backend's `src/sockets/` directory.
- Normalized tests under each workspace's `test/` directory.
- Removed nested lockfiles; the root `package-lock.json` is the only dependency lock.

No legacy application entrypoint remains in the deployable tree.
