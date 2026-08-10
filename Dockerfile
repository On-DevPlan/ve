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
# 指向 /etc/nginx/certs/fullchain.cer / privkey.key。这两个文件路径
# 必须真实存在 —— 不是只检查语法,而是 nginx -t 会真的打开证书文件
# 验证 SSL 配置。
#
# 因此 build 阶段先落一份 dummy 自签证书让 nginx -t 通过;runtime 由
# docker-entrypoint.sh 用 FULLCHAIN_B64 / PRIVKEY_B64 解码的真实证书
# 覆盖这两个文件。
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Generated API location blocks, included from inside default.conf's server{}.
# NOT placed in conf.d/ — that directory is included at http{} level, where a
# bare location block is a syntax error and nginx refuses to start.
COPY --from=builder /app/nginx/api-locations/ /etc/nginx/api-locations/

# Copy the built artifact. Note the path now lives under
# apps/showcase/dist, not /app/dist, because the root is a workspace.
COPY --from=builder /app/apps/showcase/dist /usr/share/nginx/html

# 生成 build 期 dummy 自签证书,让 nginx -t 通过。
# 为什么 build 期就需要:ssl_certificate 路径在 build 时被 nginx -t 真
# 实打开;没有证书文件 → "BIO_new_file() failed" → build 失败。
# runtime 时 entrypoint 会用真实证书覆盖这两个文件,dummy cert 不会被
# 任何客户端看到。
#
# openssl 用 -nodes(无密码)+ -subj 跳过交互;127.0.0.1 SAN 让浏览器
# / nginx 任何验证逻辑都能跑通(虽然没人会用它)。
RUN apk add --no-cache openssl \
 && mkdir -p /etc/nginx/certs \
 && openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout /etc/nginx/certs/privkey.key \
      -out    /etc/nginx/certs/fullchain.cer \
      -days 36500 -subj "/CN=dummy" \
      -addext "subjectAltName=IP:127.0.0.1" 2>/dev/null \
 && chmod 600 /etc/nginx/certs/privkey.key

# Entrypoint:把 FULLCHAIN_B64 / PRIVKEY_B64 解码成 PEM 文件,覆盖 build
# 期留下的 dummy 自签证书,然后跑官方 nginx:alpine 自带的 entrypoint。
#
# 关键:不要覆盖 nginx:alpine 自带的 /docker-entrypoint.sh(我们的脚本
# 放在 /cert-entrypoint.sh)。如果覆盖,exec /docker-entrypoint.sh 会
# 递归调用自身,导致容器反复重启。
COPY cert-entrypoint.sh /cert-entrypoint.sh
RUN chmod +x /cert-entrypoint.sh

# Sanity check — fail fast in the image build if vite didn't emit
# index.html so the runtime container never serves an empty 404 page.
RUN if [ ! -f /usr/share/nginx/html/index.html ]; then \
      echo "Error: index.html not found!"; \
      exit 1; \
    fi

# Validate default.conf + the dummy cert at build time. nginx -t actually
# opens ssl_certificate files (it doesn't only check syntax), so the dummy
# cert generated above is what makes this pass. At runtime the entrypoint
# overwrites those two files with the real FULLCHAIN_B64 / PRIVKEY_B64.
RUN nginx -t

EXPOSE 80 443

# Override the official nginx:alpine ENTRYPOINT so we can decode certs
# before its own 20-envsubst-on-templates.sh runs. We keep the official
# /docker-entrypoint.sh untouched and chain to it from /cert-entrypoint.sh.
ENTRYPOINT ["/cert-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]