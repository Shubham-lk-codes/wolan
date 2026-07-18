# MongoDB indexes

Shared Mongoose schemas are the executable source of truth for collection indexes. Run `npm run db:indexes` after a deployment or migration to create missing indexes without dropping existing ones.

The command refuses any database name other than `wolan`. Review index changes in staging before applying them to production, and use Atlas index-build monitoring for large collections.
