FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY admin/backend/package.json admin/backend/package.json
COPY admin/frontend/package.json admin/frontend/package.json
COPY merchant-backend/package.json merchant-backend/package.json
COPY driver-backend/package.json driver-backend/package.json
RUN npm ci --omit=dev --workspace @wolan/shared --workspace @wolan/driver-backend

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S wolan && adduser -S wolan -G wolan
COPY --from=dependencies /app ./
COPY --chown=wolan:wolan shared ./shared
COPY --chown=wolan:wolan driver-backend ./driver-backend
USER wolan
EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:5002/api/v1/driver/health || exit 1
CMD ["node", "driver-backend/src/server.js"]
