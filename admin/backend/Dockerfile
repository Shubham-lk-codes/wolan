FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY admin/backend/package.json admin/backend/package.json
COPY admin/frontend/package.json admin/frontend/package.json
COPY merchant-backend/package.json merchant-backend/package.json
COPY driver-backend/package.json driver-backend/package.json
RUN npm ci --omit=dev --workspace @wolan/shared --workspace @wolan/admin-backend

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S wolan && adduser -S wolan -G wolan
COPY --from=dependencies /app ./
COPY --chown=wolan:wolan shared ./shared
COPY --chown=wolan:wolan admin/backend ./admin/backend
USER wolan
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:5000/api/v1/public/health || exit 1
CMD ["node", "admin/backend/src/server.js"]
