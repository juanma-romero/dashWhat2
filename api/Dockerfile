FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# `npm ci` instala EXACTAMENTE lo que fija package-lock.json (Baileys 7.0.0-rc.9).
# Con `npm install` y las dependencias en "*", cada rebuild bajaba la última rc publicada:
# el payload que queremos auditar podía cambiar entre builds sin que nadie lo note.
RUN npm ci --no-cache && npm cache clean --force

COPY . .

EXPOSE 8880

CMD ["npm", "start"]