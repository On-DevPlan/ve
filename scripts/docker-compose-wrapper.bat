@echo off
REM Docker Compose 兼容性包装器脚本 (Windows)
REM 自动检测并使用合适的 Docker Compose 命令

REM 检测 docker-compose
where docker-compose >nul 2>nul
if %ERRORLEVEL% == 0 (
    set COMPOSE_CMD=docker-compose
    goto :run
)

REM 检测 docker compose (新版本)
docker compose version >nul 2>nul
if %ERRORLEVEL% == 0 (
    set COMPOSE_CMD=docker compose
    goto :run
)

echo Error: Neither docker-compose nor docker compose is installed
echo Please install Docker Compose:
echo   - For Docker Desktop: docker compose is included
echo   - For Linux: https://docs.docker.com/compose/install/
exit /b 1

:run
echo Using: %COMPOSE_CMD%
%COMPOSE_CMD% %*