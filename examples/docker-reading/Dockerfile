# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS verify
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm test

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=verify /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
