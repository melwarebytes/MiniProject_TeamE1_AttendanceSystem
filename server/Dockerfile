FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY . .
RUN npx prisma generate
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
# Schema changes run in the separate migration service.
CMD ["node", "src/index.js"]
