FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY admin/backend/package.json admin/backend/package.json
COPY admin/frontend/package.json admin/frontend/package.json
COPY merchant-backend/package.json merchant-backend/package.json
COPY driver-backend/package.json driver-backend/package.json
RUN npm ci --workspace @wolan/admin-frontend
COPY admin/frontend admin/frontend
ARG VITE_API_URL=/api/v1/admin
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace @wolan/admin-frontend

FROM nginx:1.27-alpine
COPY admin/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
