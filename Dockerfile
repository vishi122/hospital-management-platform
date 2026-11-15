# ==============================================================================
# Multi-Stage Dockerfile for Hospital Management Platform
# Base image: Node.js 22 Alpine (pinned tag for reproducible builds)
# ==============================================================================

# Stage 1: Dependency resolution and production prune
FROM node:22.14.0-alpine AS deps
WORKDIR /app

# Install dependencies needed for build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Stage 2: Final minimal production runtime
FROM node:22.14.0-alpine AS runner
WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production \
    PORT=3000

# Install wget for healthcheck if needed (built into alpine)
RUN apk add --no-cache wget ca-certificates

# Copy production dependencies from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node scripts/ ./scripts/

# Use unprivileged non-root user (node:node uid 1000)
USER node

# Expose internal application port (not published directly to host)
EXPOSE 3000

# Docker healthcheck calling the HTTP /health liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start production API server
CMD ["node", "src/server.js"]
