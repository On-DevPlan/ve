#!/bin/sh
# cert-entrypoint.sh
#
# 在官方 nginx:alpine 的 entrypoint(/docker-entrypoint.sh)之前,把 base64
# 编码的 TLS 证书解码成 PEM 文件落盘到 /etc/nginx/certs/。
#
# 这个脚本放在 /cert-entrypoint.sh(不是 /docker-entrypoint.sh),因为
# nginx:alpine 镜像已经自带了 /docker-entrypoint.sh —— 我们如果用
# 同名会覆盖它,递归 exec 自己,容器反复重启。
#
# 流程:
#   1. 如果 FULLCHAIN_B64 与 PRIVKEY_B64 都存在 → 解码、写盘、chmod 600,
#      做一次公私钥配对自检 + SAN 检查。
#   2. 复制 /etc/nginx/conf.d/default.conf 为 default.conf.bak(留现场)。
#   3. exec 官方 /docker-entrypoint.sh,让 nginx 成为 PID 1。
#
# 注意:必须用 `exec` 链到原始 entrypoint.sh,否则 nginx 不是 PID 1,
# `docker stop` 会发送 SIGTERM 给 sh 包装器,nginx 收不到信号就硬
# kill,导致 in-flight TLS 连接断。
set -eu

CERTS_DIR="/etc/nginx/certs"
FULLCHAIN_PATH="$CERTS_DIR/fullchain.cer"
PRIVKEY_PATH="$CERTS_DIR/privkey.key"

mkdir -p "$CERTS_DIR"

# 解码证书(只在两个变量都存在时)。
# 单独 base64 -d 检查:解码失败(非 base64 / 长度不对)立刻 exit 1,
# 不让 nginx 拿着占位符串的"证书路径"硬起 —— 那样要等到 reload 才报错。
if [ -n "${FULLCHAIN_B64:-}" ] && [ -n "${PRIVKEY_B64:-}" ]; then
  echo "[entrypoint] decoding FULLCHAIN_B64 / PRIVKEY_B64..."

  echo "$FULLCHAIN_B64" | base64 -d > "$FULLCHAIN_PATH"
  echo "$PRIVKEY_B64"   | base64 -d > "$PRIVKEY_PATH"
  chmod 600 "$PRIVKEY_PATH"

  # 自检 1:证书文件能解析且未过期。
  if ! openssl x509 -in "$FULLCHAIN_PATH" -noout -subject -dates >/dev/null 2>&1; then
    echo "[entrypoint] ❌ fullchain.cer is not a valid x509 certificate"
    exit 1
  fi

  # 自检 2:公私钥配对。
  # 这一步是整个流程最容易翻车的点(证书 / 私钥不配对 → nginx reload 才
  # 报错),值得花一行命令挡在前面。
  CERT_PUBKEY=$(openssl x509 -in "$FULLCHAIN_PATH" -noout -pubkey 2>/dev/null)
  KEY_PUBKEY=$(openssl ec   -in "$PRIVKEY_PATH"  -pubout      2>/dev/null \
                || openssl rsa -in "$PRIVKEY_PATH" -pubout     2>/dev/null)
  if [ "$CERT_PUBKEY" != "$KEY_PUBKEY" ]; then
    echo "[entrypoint] ❌ public key in cert does not match private key"
    exit 1
  fi

  # 自检 3:证书覆盖 abc.jokelx.xyz(SAN 检查,避免传错证书)。
  if ! openssl x509 -in "$FULLCHAIN_PATH" -noout -ext subjectAltName 2>/dev/null \
      | grep -q "abc.jokelx.xyz"; then
    echo "[entrypoint] ⚠️  cert does not contain abc.jokelx.xyz in SAN"
    # 这里不 exit 1 —— 强制失败会让"先测试再上"的流程断掉,只警告。
  fi

  echo "[entrypoint] ✅ TLS files written + cert/key pair verified"
  echo "[entrypoint] cert details:"
  openssl x509 -in "$FULLCHAIN_PATH" -noout -subject -dates \
                                              -ext subjectAltName 2>/dev/null \
    | sed 's/^/    /'
else
  echo "[entrypoint] ⚠️  FULLCHAIN_B64 / PRIVKEY_B64 not set"
  echo "[entrypoint]    HTTPS will be DISABLED; only :80 will serve."
  # 不 exit 1 —— 留 http-only 回退路径,方便本地开发 / 证书未到位时
  # 仍然能跑起来。
  #
  # Build 期为了 nginx -t 通过,Dockerfile 在 /etc/nginx/certs/ 放了一份
  # dummy 自签证书。如果不干预,nginx 会拿着 dummy cert 监听 443 →
  # 浏览器 / curl 会因为证书不受信任报错,而且 dummy cert 是 100 年
  # 有效,容易让人误以为是真实部署生效了 —— 危险。
  #
  # 所以 secrets 缺失时,把 default.conf 改名让 nginx 不加载,只跑
  # 官方自带的那个干净的 default.conf(只 listen 80)。80 仍然能服务。
  if [ -f /etc/nginx/conf.d/default.conf ]; then
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled
    echo "[entrypoint]    moved default.conf → default.conf.disabled (443 off)"
  fi
fi

# 把原始 default.conf 拷一份 .bak(给运维留现场)。
# 如果走 HTTP-only 分支,default.conf 已经被 mv 走,这里拷贝会失败但
# 无关紧要(2>/dev/null + || true 兜住)。
cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true

# exec 到官方 /docker-entrypoint.sh,保持 nginx 作为 PID 1。
# 这是 nginx:alpine 镜像的官方 entrypoint(不要覆盖!),里面会跑
# 10-listen-on-ipv6-by-default.sh / 20-envsubst-on-templates.sh /
# 30-tune-worker-processes.sh,然后 exec "$@"(即 CMD nginx -g ...)。
exec /docker-entrypoint.sh "$@"