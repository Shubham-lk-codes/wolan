# Admin API source structure

The Admin API uses the same domain-based layout as the Merchant and Driver APIs.

- `controllers/` translates HTTP requests into service calls. Each business area has its own controller.
- `routes/` owns URLs, permissions, validation, and middleware for one business area. `routes/index.js` only mounts these routers.
- `services/` contains Admin-specific service instances and Live Map data composition.
- `utils/` contains pure reusable calculations.
- `sockets/` handles authenticated real-time rooms and event publishing.
- `jobs/` contains background processing.
- `config/` contains environment and database configuration.

When adding an endpoint, place its request handling in the matching controller and its URL definition in the matching route file. Add a new domain pair only when no existing domain fits.
