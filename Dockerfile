# Use multi-stage build.
# Stage 1 — install + build showcase in the monorepo.
# Stage 2 — serve the built dist/ via nginx:alpine.
#
# Layout notes:
#   - This repo is a pnpm workspace (apps/ + packages/).
#   - Root package.json#scripts.build routes through
#     \`pnpm --filter @style-library/showcase build\`.
#   - pnpm corepack version is pinned to whatever root
#     package.json#packageManager says, so CI and Docker stay in sync.
#
# Build context gotcha: COPY must hand pnpm every workspace manifest
# before \`pnpm install --frozen-lockfile\` so it can resolve the
# workspace graph and materialize @style-library/* node_modules links.

# ---- Stage 1: builder ----
FROM node:22-alpine AS builder

WORKDIR /app

# Pin pnpm to whatever root package.json#packageManager says.
RUN corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

# Monorepo top-level manifests + lockfile. Order matters:
# these three files let pnpm resolve the workspace graph and verify
# `--frozen-lockfile` without yet touching any source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json vitest.workspace.ts ./

# Workspace subtree manifests. pnpm needs to see package.json for each
# workspace package so it can install their deps and resolve workspace:*
# links. Sources are copied next, but their package.json must be present
# before install so the workspace protocol can resolve.
COPY apps ./apps
COPY packages ./packages

# Install everything — root devDeps + every workspace.
# This is what produces apps/showcase/node_modules/.bin/vite, which
# `pnpm --filter @style-library/showcase build` will invoke.
RUN pnpm install --frozen-lockfile

# Everything else: eslint config, scripts, eslint-rules, .gitignore etc.
# Already-copied files are overwritten by this — pnpm install must have
# run before this line so node_modules in apps/ and packages/ already
# exist with the right pnpm symlink layout.
COPY . .

# Workaround legacy crypto provider complaints from a few transitive
# webpack/terser plugins when Node 22 builds the old vue 3.4 demo.
# Safe to keep: NODE_OPTIONS is forwarded into Vite's worker children.
ENV NODE_OPTIONS="--openssl-legacy-provider"

# Drives vite build via the workspace-aware root script.
RUN pnpm run build

# ---- Stage 2: runtime ----
FROM nginx:alpine

# Custom nginx site config overriding the default.conf that ships in
# nginx:alpine. Mounted at /etc/nginx/conf.d/default.conf so it actually
# wins against the bundled /etc/nginx/nginx.conf.
COPY default.conf /etc/nginx/conf.d/default.conf

# Copy the built artifact. Note the path now lives under
# apps/showcase/dist, not /app/dist, because the root is a workspace.
COPY --from=builder /app/apps/showcase/dist /usr/share/nginx/html

# Sanity check — fail fast in the image build if vite didn't emit
# index.html so the runtime container never serves an empty 404 page.
RUN ls -la /usr/share/nginx/html/ \
 && if [ ! -f /usr/share/nginx/html/index.html ]; then \
      echo "Error: index.html not found!"; \
      exit 1; \
    fi

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
