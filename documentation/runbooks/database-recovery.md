# MongoDB recovery runbook

Use Atlas continuous backup and point-in-time restore into an isolated recovery cluster. Never restore staging data over production or connect a staging API to the production database.

After restore, verify the database name is `wolan`, run the index verifier, compare critical collection counts, validate one order/custody/COD chain per hub, rotate restored credentials, and only then switch application traffic. Record the recovery point, validation evidence, and approver in the incident log.
