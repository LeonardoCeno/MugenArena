# Stage 1 — build Vue app
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2 — PHP + Apache
FROM php:8.4-apache

COPY --from=builder /app/ /var/www/html/frontend/
COPY backend/ /var/www/html/backend/

RUN chown -R www-data:www-data /var/www/html && \
    echo '<html><head><meta http-equiv="refresh" content="0;url=/frontend/"></head></html>' \
    > /var/www/html/index.html && \
    a2enmod rewrite

EXPOSE 80
