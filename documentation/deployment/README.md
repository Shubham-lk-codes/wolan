# Deployment

The root Compose file is a local container topology for the Admin Web, three APIs, and Redis. MongoDB is intentionally not provisioned: set `MONGODB_URI` to the environment's Atlas cluster and keep `MONGODB_DB_NAME=wolan`.

## Production services

| Service | Public URL | API base |
| --- | --- | --- |
| Admin frontend | `https://wolan-frontend.vercel.app` | n/a |
| Admin API | `https://wolan-admin.onrender.com` | `/api/v1/admin` |
| Merchant API | `https://wolan-merchant.onrender.com` | `/api/v1/merchant` |
| Driver API | `https://wolan-driver.onrender.com` | `/api/v1/driver` |

Configure the Vercel production build with:

```env
VITE_API_URL=https://wolan-admin.onrender.com/api/v1/admin
VITE_PUBLIC_API_URL=https://wolan-admin.onrender.com/api/v1/public
VITE_SOCKET_URL=https://wolan-admin.onrender.com
```

Configure each Render API with:

```env
NODE_ENV=production
CORS_ORIGINS=https://wolan-frontend.vercel.app
```

Render supplies `PORT` automatically; each API now reads it first and falls back to its service-specific local port. Configure these health-check paths in Render:

- Admin: `/api/v1/public/health`
- Merchant: `/api/v1/merchant/health`
- Driver: `/api/v1/driver/health`

The repository's `admin/frontend/.env.production` contains the Vercel build-time URLs. Redeploy the Vercel project after changing any `VITE_*` value because Vite embeds these values during the build.

Release order:

1. Run tests and the admin production build.
2. Apply `npm run db:migrate` once.
3. Apply `npm run db:indexes` and monitor Atlas index builds.
4. Roll out APIs and workers, then Admin Web.
5. Verify all health endpoints and a hub-isolation smoke test.
