FROM node:22-alpine AS builder
WORKDIR /app

# Copy package definition and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

FROM node:22-alpine
WORKDIR /app

# Create unprivileged application user
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

# Copy production node_modules from builder
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules

# Copy package metadata
COPY --chown=appuser:appuser package*.json ./

# Copy essential application runtime directories
COPY --chown=appuser:appuser config/ ./config/
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser scripts/ ./scripts/

# Create runtime directories with correct unprivileged ownership
RUN mkdir -p uploads storage/tests .email-spool && \
    chown -R appuser:appuser uploads storage .email-spool

EXPOSE 5001
USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "src/app-port5001.js"]
