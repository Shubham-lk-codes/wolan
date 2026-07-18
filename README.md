# Wolan Logistics Platform

MERN logistics platform organized as five npm workspaces: Admin Web, Admin API, Merchant API, Driver API, and the shared domain package.

## Local verification

```sh
npm install
npm run check
npm test
npm run build
```

Copy `.env.example` to `.env`, provide Atlas/JWT/webhook secrets, then start the desired workspace with `npm run dev:admin`, `dev:merchant`, `dev:driver`, or `dev:web`.

See the [approved architecture](documentation/ARCHITECTURE_APPROVAL_PLAN.md), [source migration inventory](documentation/architecture/source-migration-inventory.md), [API notes](documentation/api/README.md), and [deployment guide](documentation/deployment/README.md).
