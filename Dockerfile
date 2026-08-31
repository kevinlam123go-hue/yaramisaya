# syntax=docker/dockerfile:1
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
# Ensure data directory exists
RUN mkdir -p /usr/src/app/data
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node","server.js"]
