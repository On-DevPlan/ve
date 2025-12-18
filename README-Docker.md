# Docker Compose 使用说明

本项目提供了多种Docker Compose配置，适用于不同的场景。

## 文件说明

- `docker-compose.yml` - 基础配置，包含应用服务
- `docker-compose.override.yml` - 开发环境覆盖文件（自动加载）
- `docker-compose.prod.yml` - 生产环境特定配置
- `nginx-proxy.conf` - 可选的反向代理配置

## 使用方法

### 1. 本地开发模式

使用热重载开发服务器：

```bash
# 构建并启动开发环境
docker-compose up --build

# 或者在后台运行
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

访问地址：http://localhost:5173

### 2. 生产模式

运行构建后的应用：

```bash
# 使用生产配置启动
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 停止生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

访问地址：http://localhost:8001

### 3. 使用反向代理

如果需要使用nginx反向代理：

```bash
# 启动应用和反向代理
docker-compose --profile proxy up -d --build
```

访问地址：http://localhost

### 4. 指定版本

部署特定版本：

```bash
# 设置版本并部署
VERSION=v1.0.0 docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 环境变量

- `NODE_ENV` - 环境类型（development/production）
- `VERSION` - 应用版本号

## 兼容性说明

本项目的Docker Compose文件同时兼容：
- **Docker Compose V1** (docker-compose 命令)
- **Docker Compose V2** (docker compose 命令)

GitHub Actions会自动检测并使用正确的命令。

### 本地使用包装器脚本

为了避免每次都输入完整的命令，可以使用提供的包装器脚本：

**Linux/Mac:**
```bash
# 给脚本添加执行权限
chmod +x scripts/docker-compose-wrapper.sh

# 使用包装器
./scripts/docker-compose-wrapper.sh up -d
```

**Windows:**
```cmd
# 使用批处理文件
scripts\docker-compose-wrapper.bat up -d
```

## 常用命令

### 使用原生命令（二选一）

```bash
# 使用 docker-compose (V1)
docker-compose up -d
docker-compose ps
docker-compose down

# 或使用 docker compose (V2)
docker compose up -d
docker compose ps
docker compose down
```

### 使用包装器脚本（自动选择）

```bash
# Linux/Mac
./scripts/docker-compose-wrapper.sh up -d

# Windows
scripts\docker-compose-wrapper.bat up -d

# 通用命令
docker-compose-wrapper.sh build
docker-compose-wrapper.sh ps
docker-compose-wrapper.sh exec app sh
docker-compose-wrapper.sh logs app
docker-compose-wrapper.sh down -v
```

### 其他常用操作

```bash
# 重新构建镜像
./scripts/docker-compose-wrapper.sh build

# 强制重新构建（不使用缓存）
./scripts/docker-compose-wrapper.sh build --no-cache

# 查看运行状态
./scripts/docker-compose-wrapper.sh ps

# 进入容器
./scripts/docker-compose-wrapper.sh exec app sh

# 查看日志
./scripts/docker-compose-wrapper.sh logs app

# 实时查看日志
./scripts/docker-compose-wrapper.sh logs -f app

# 清理（停止并删除容器、网络、卷）
./scripts/docker-compose-wrapper.sh down -v

# 重启服务
./scripts/docker-compose-wrapper.sh restart

# 更新并重启
./scripts/docker-compose-wrapper.sh pull
./scripts/docker-compose-wrapper.sh up -d
```

## 健康检查

生产环境配置了健康检查，可以通过以下命令查看：

```bash
# 检查健康状态
docker-compose exec app curl -f http://localhost/health

# 或者直接访问
curl http://localhost:8001/health
```