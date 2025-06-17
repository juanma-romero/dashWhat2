# Usar una imagen base de Node.js (versión 22-slim para ser más ligera)
FROM node:22-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
# Esto ayuda a aprovechar el cache de Docker si las dependencias no cambian
COPY package*.json ./

# Instalar dependencias de producción
# Usar 'npm ci' para instalaciones limpias y consistentes basadas en package-lock.json
RUN npm ci --only=production

# Copiar el resto del código de la aplicación
COPY . .

# Cloud Run inyectará la variable de entorno PORT.
# La aplicación ya está configurada para escuchar en process.env.PORT.
# EXPOSE 8080 # Opcional, pero buena práctica para documentar el puerto

# Comando para iniciar la aplicación
CMD [ "node", "index.js" ]
