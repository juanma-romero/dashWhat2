#!/bin/sh

if [ ! -d "/app/baileys_auth_info" ]; then
  echo "Creando el directorio de autenticación inicial..."
  mkdir -p /app/baileys_auth_info
fi

exec npm start