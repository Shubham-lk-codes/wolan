# Deployment

The root Compose file is a local container topology for the Admin Web, three APIs, and Redis. MongoDB is intentionally not provisioned: set `MONGODB_URI` to the environment's Atlas cluster and keep `MONGODB_DB_NAME=wolan`.

Release order:

1. Run tests and the admin production build.
2. Apply `npm run db:migrate` once.
3. Apply `npm run db:indexes` and monitor Atlas index builds.
4. Roll out APIs and workers, then Admin Web.
5. Verify all health endpoints and a hub-isolation smoke test.
