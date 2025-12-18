# 使用多阶段构建
# 第一阶段：构建应用
FROM node:22-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 设置NODE_OPTIONS以处理crypto问题
ENV NODE_OPTIONS="--openssl-legacy-provider"

# 构建应用
RUN npm run build

# 第二阶段：nginx服务
FROM nginx:alpine

# 复制自定义nginx站点配置（覆盖默认配置）
COPY default.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 验证文件是否正确复制
RUN ls -la /usr/share/nginx/html/ && \
    if [ ! -f /usr/share/nginx/html/index.html ]; then \
        echo "Error: index.html not found!" && exit 1; \
    fi

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]