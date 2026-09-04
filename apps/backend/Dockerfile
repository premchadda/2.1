FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --prod --frozen-lockfile; else npm ci --omit=dev; fi

FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

EXPOSE 5001
USER appuser

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "src/app-port5001.js"]