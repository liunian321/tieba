FROM node:21-alpine AS build

LABEL authors="LieQing"

# 设置工作目录
WORKDIR /app

COPY ./ ./

RUN npm i yarn -g && yarn i

RUN yarn build

FROM node:21-alpine

# 设置工作目录
WORKDIR /app

# 从 build 阶段复制编译后的代码
COPY --from=build /app/dist ./

CMD [ "node", "main.js" ]