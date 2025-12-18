#!/bin/bash

# Docker Compose 兼容性包装器脚本
# 自动检测并使用合适的 Docker Compose 命令

# 检测Docker Compose命令
detect_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    elif docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "Error: Neither docker-compose nor docker compose is installed"
        echo "Please install Docker Compose:"
        echo "  - For Docker Desktop: docker compose is included"
        echo "  - For Linux: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# 获取Docker Compose命令
COMPOSE_CMD=$(detect_compose_cmd)
echo "Using: $COMPOSE_CMD"

# 执行传入的参数
$COMPOSE_CMD "$@"