FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci --only=production

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