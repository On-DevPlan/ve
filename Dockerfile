# Use multi-stage build.
# Stage 1 — install + build showcase in the monorepo.
# Stage 2 — serve the built dist/ via nginx:alpine.
#
# Layout notes:
#   - This repo is a pnpm workspace (apps/ + packages/).
#   - Root package.json#scripts.build routes through
#     `pnpm --filter @style-library/showcase build`.
#   - pnpm corepack version is pinned to whatever root
#     package.json#packageManager says, so CI and Docker stay in sync.
#
# Build context gotcha:
#   `.dockerignore` only ignores root `node_modules` — it DOES NOT ignore
#   `apps/showcase/node_modules` (which is an empty pnpm-symlink dir on
#   the host). So if we `COPY apps ./apps` before `pnpm install`, the
#   empty host dir silently overwrites the container `node_modules` just
#   populated by `pnpm install`. The fix: copy everything FIRST, then
#   install, then build.

# ---- Stage 1: builder ----
FROM node:22-alpine AS builder

WORKDIR /app

# Pin pnpm to whatever root package.json#packageManager says.
RUN corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

# Copy EVERYTHING in one shot, then install, then build.
# This avoids nested node_modules being overwritten by a prior empty COPY.
COPY . .

# Install all workspace dependencies (root devDeps + every workspace).
# After this, apps/showcase/node_modules/.bin/vite exists.
RUN pnpm install --frozen-lockfile

# Workaround legacy crypto provider complaints from a few transitive
# webpack/terser plugins when Node 22 builds the old vue 3.4 demo.
ENV NODE_OPTIONS="--openssl-legacy-provider"

# Drives `pnpm --filter @style-library/showcase build` via root script.
# vite.config.ts registers the gen-nginx-locations plugin, which during build
# writes nginx/api-locations/generated.conf from the same registry the dev
# server reads (apps/showcase/src/api/registry.ts). One source of truth for
# dev and prod routing.
RUN pnpm run build

# `cat` the generated file so the build log captures the nginx config that
# ships in the image — fail-fast visibility if the registry gets a weird entry.
RUN cat nginx/api-locations/generated.conf

# ---- Stage 2: runtime ----
FROM nginx:alpine

# Custom nginx site config overriding the default.conf that ships in
# nginx:alpine. Mounted at /etc/nginx/conf.d/default.conf so it actually
# wins against the bundled /etc/nginx/nginx.conf.
COPY default.conf /etc/nginx/conf.d/default.conf

# Generated API location blocks, included from inside default.conf's server{}.
# NOT placed in conf.d/ — that directory is included at http{} level, where a
# bare location block is a syntax error and nginx refuses to start.
COPY --from=builder /app/nginx/api-locations/ /etc/nginx/api-locations/

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

# Validate the full nginx config (hand-written default.conf + generated
# locations) at image build time. Without this, a malformed generated file
# only surfaces as a crash-looping container after deploy — and the health
# check would report failure with no indication that nginx never parsed.
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
