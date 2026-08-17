# Базовый образ берём с зеркала AWS Public ECR, а не с Docker Hub:
# Docker Hub лимитирует анонимные pull'ы (429 Too Many Requests) при деплое.
FROM public.ecr.aws/docker/library/node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=3100
EXPOSE 3100
CMD ["node", "server/index.js"]
