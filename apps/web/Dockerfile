ARG NODE_VERSION=22-alpine
FROM node:${NODE_VERSION} AS base

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install system deps (wget for healthcheck, libc6-compat for sharp/next)
RUN apk add --no-cache wget libc6-compat

WORKDIR /repo

# Copy workspace roots
COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies (dev deps are required for the
# Next build).  npm workspaces hoist everything to the root
# `node_modules`; the per-workspace node_modules are NOT created.
RUN npm install --no-audit --no-fund

# Build the shared and database packages first (they are runtime deps
# of the web app via the published artifacts).
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
RUN npm run build --workspace=@bot/shared \
 && npm run build --workspace=@bot/database

# Copy the web app source and build it
COPY apps/web ./apps/web
RUN npm run build --workspace=@bot/web

# ---------------------------------------------------------------------------
# Development stage — used by docker-compose.dev.yml.  Inherits the full
# dependency tree from `base` and runs the Next dev server with HMR.
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@bot/web"]

# Drop dev dependencies for the final image.  The `base` stage already
# built the Next app with NODE_ENV=production, so we only need to trim
# devDependencies to shrink the image.
FROM base AS prod-deps
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Final stage
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget && addgroup -S app && adduser -S app -G app

WORKDIR /repo
COPY --from=prod-deps /repo /repo
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "start", "--workspace=@bot/web"]
