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
#
# TLS 说明:443 server 块里 ssl_certificate / ssl_certificate_key 写死
# 指向 /etc/nginx/certs/fullchain.cer / privkey.key。这两个文件由我们
# 自定义的 docker-entrypoint.sh 在容器启动时从 TLS_FULLCHAIN_B64 /
# TLS_PRIVKEY_B64 环境变量解码落盘。即使 secrets 暂时没传(本地开发),
# entrypoint 也会创建空文件,nginx 启动仅报 warning 而非拒启 —— 这样
# HTTP-only 回退路径仍然能跑。
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Generated API location blocks, included from inside default.conf's server{}.
# NOT placed in conf.d/ — that directory is included at http{} level, where a
# bare location block is a syntax error and nginx refuses to start.
COPY --from=builder /app/nginx/api-locations/ /etc/nginx/api-locations/

# Copy the built artifact. Note the path now lives under
# apps/showcase/dist, not /app/dist, because the root is a workspace.
COPY --from=builder /app/apps/showcase/dist /usr/share/nginx/html

# Entrypoint:把 TLS_FULLCHAIN_B64 / TLS_PRIVKEY_B64 解码成 PEM 文件,
# 然后跑官方 nginx:alpine 自带的 entrypoint(envsubst + nginx -g)。
#
# 不覆盖 ENTRYPOINT,而是用一个小 wrapper 在原 entrypoint 之前先落盘
# 证书。原 entrypoint 是 /docker-entrypoint.d/ 下的脚本链,签名固定为
# `entrypoint.sh` -> 链式调用 20-envsubst-on-templates.sh 等。
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 自检:index.html 必须存在(避免运行时 404)。同时单独验一次 default.conf
# 的占位符配置解析合法 —— envsubst 之前 nginx -t 看不到 placeholder,
# 仍然能通过(占位符串是合法路径)。
RUN ls -la /usr/share/nginx/html/ \
 && if [ ! -f /usr/share/nginx/html/index.html ]; then \
      echo "Error: index.html not found!"; \
      exit 1; \
    fi

# Validate the hand-written default.conf at build time. TLS certs aren't
# present during build (they're delivered via CI secrets + decoded by the
# entrypoint), so ssl_certificate paths point to files the entrypoint
# creates at runtime — nginx -t only checks syntax, not file existence.
RUN nginx -t

EXPOSE 80 443

# Override the official nginx:alpine ENTRYPOINT so we can decode certs
# before its own 20-envsubst-on-templates.sh runs.
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]