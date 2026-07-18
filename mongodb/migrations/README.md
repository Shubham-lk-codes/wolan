# Database migrations

Migration files are ordered, forward-only JavaScript modules that export `id` and `up`. Applied migration ids are recorded as `Setting` documents under `HUB_GLOBAL`, keeping all persisted application records inside the approved shared model set.

Run `npm run db:migrate` once per release before starting the new application version. Backward-compatible migrations are required for rolling deployments.
