# Architecture

The approved architecture is defined in [ARCHITECTURE_APPROVAL_PLAN.md](../ARCHITECTURE_APPROVAL_PLAN.md). The executable boundaries are the root npm workspaces: Admin Web, Admin API, Merchant API, Driver API, and `@wolan/shared`.

All APIs use the same `MONGODB_URI` and the explicitly named `wolan` database. Shared models, authorization scope, validation, repositories, events, and cross-platform domain services live only in `shared/`.
