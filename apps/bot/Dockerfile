# syntax=docker/dockerfile:1.6
# ----- Stage 1: install all dependencies (including dev) for building -----
FROM node:20-alpine AS deps
WORKDIR /app
# Install build-time deps (prisma needs OpenSSL at generate time)
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY apps/bot/package.json apps/bot/
RUN npm ci --no-audit --no-fund --include=dev

# ----- Stage 2: build TypeScript and generate Prisma client -----
FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json tsconfig.json ./
COPY packages packages
COPY apps/bot apps/bot
RUN npm run db:generate
# Build only the bot workspace so the root `tsc -b` does not need the
# web project to be present in the image.
RUN npx tsc -b apps/bot

# ----- Stage 3: install production-only deps (root-only is fine, npm
# workspaces hoist everything) -----
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY apps/bot/package.json apps/bot/
RUN npm ci --omit=dev --no-audit --no-fund

# ----- Stage 4: minimal runtime image -----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl wget
ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

# Copy production deps (hoisted to /app/node_modules) and built artifacts
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/database/package.json ./packages/database/
COPY --from=build /app/packages/database/prisma ./packages/database/prisma
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/package.json ./apps/bot/

# Create non-root user and logs directory
RUN addgroup -S bot && adduser -S bot -G bot && \
    mkdir -p /app/logs && chown -R bot:bot /app
USER bot

WORKDIR /app/apps/bot
EXPOSE 3001

# Healthcheck uses wget (already installed in this stage)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/bot/stats || exit 1

CMD ["sh", "-c", "node ../../node_modules/prisma/build/index.js migrate deploy --schema=../../packages/database/prisma/schema.prisma && node dist/index.js"]
