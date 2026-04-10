FROM php:8.4-apache

WORKDIR /var/www/html

# Define ServerName global para evitar aviso AH00558 no startup do Apache.
RUN printf "ServerName localhost\n" > /etc/apache2/conf-available/servername.conf \
	&& a2enconf servername

COPY . /var/www/html

# Garante permissões de leitura para o conteúdo e gravação de sessão no runtime.
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]
