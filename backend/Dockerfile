# Usa la imagen oficial de Node.js como base
FROM node:18-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de package
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos de la app
COPY . .

# Comando para ejecutar la app
CMD ["npm", "start"]