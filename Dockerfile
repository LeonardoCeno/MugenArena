# Stage 1 — build Vue app
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2 — PHP + Apache
FROM php:8.4-apache

RUN a2enmod rewrite && \
    sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Only built output — no node_modules/src exposed
COPY --from=builder /app/index.html /var/www/html/
COPY --from=builder /app/src/assets-built/ /var/www/html/src/assets-built/
COPY --from=builder /app/assets/ /var/www/html/assets/
COPY --from=builder /app/tutorial-content.html /var/www/html/
COPY backend/ /var/www/html/backend/

RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
