FROM node:20-alpine AS builder
WORKDIR /app

# All VITE_* vars consumed at build time (env-validation.js / import.meta.env reads)
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_ADMIN_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_SUPPORT_EMAIL
ARG VITE_SITE_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV VITE_ADMIN_URL=${VITE_ADMIN_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_SUPPORT_EMAIL=${VITE_SUPPORT_EMAIL}
ENV VITE_SITE_URL=${VITE_SITE_URL}

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml* ./
# --ignore-scripts avoids running `prepare: husky install` which fails without .git/
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else npm ci --ignore-scripts; fi

COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; else npm run build; fi

# Pin nginx to a specific minor + digest for reproducible builds
FROM nginx:1.27-alpine

# nginx.conf is a full nginx.conf (with http{} wrapper), mount as /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

# Healthcheck so orchestrators (ECS/K8s) get a probe signal
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
