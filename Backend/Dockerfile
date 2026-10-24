# ==============================================================================
# eReceipt Backend - Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install native dependencies required for build tools
RUN apk add --no-cache python3 make g++

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compiler)
RUN npm ci

# Copy source code and TypeScript configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install runtime dependencies for healthchecks
RUN apk add --no-cache curl wget

# Create unprivileged application user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# Copy package descriptors and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Copy database scripts and initial data template
COPY --from=builder /app/src/database ./src/database
COPY data/ ./data/

# Ensure application files, data directory, and uploads are owned by nodejs user
RUN mkdir -p /app/data /app/uploads/licenses && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]
