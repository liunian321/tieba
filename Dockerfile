# 阶段一：构建应用
FROM node:21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制项目文件并安装依赖
COPY package.json yarn.lock ./
RUN yarn install

# 复制应用程序代码
COPY . .

# 构建应用
RUN yarn build

# 阶段二：运行应用
FROM node:21-alpine AS runner

# 设置工作目录
WORKDIR /app

# 只复制构建后的文件和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "./dist/main"]

