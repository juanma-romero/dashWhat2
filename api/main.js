import 'dotenv/config' // Importante: debe ir primero para cargar las variables de entorno
import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'

// --- Configuración de Cloudinary ---
// Lee las credenciales de forma segura desde el archivo .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express()
app.use(express.json())

const phonesToFilter = JSON.parse(fs.readFileSync('./phones.json', 'utf-8')).phones;

// --- Nueva Función para Subir Medios a Cloudinary ---
// Esta función toma un buffer (imagen, audio, etc.) y lo sube.
async function uploadMediaToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' }, // Permite que Cloudinary detecte si es imagen, audio o video
      (error, result) => {
        if (error) {
          console.error('Error subiendo a Cloudinary:', error);
          return reject(error);
        }
        resolve(result.secure_url); // Devuelve la URL segura del archivo subido
      }
    );
    uploadStream.end(buffer);
  });
}

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')   
    const sock = makeWASocket({ auth: state })

    sock.ev.on('creds.update', saveCreds)    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.log('Escanea este código QR con tu teléfono:')
            console.log(await QRCode.toString(qr, {type:'terminal', small: true}))
        }
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('Conexión cerrada por ', lastDisconnect.error, ', reconectando... ', shouldReconnect)
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('Conexión abierta')
        }
    })

    sock.ev.on('messages.upsert', async m => { 
        try {
            for (const message of m.messages) {
                if (!message.key || !message.message || message.key.remoteJid.includes('@newsletter') ||message.key.remoteJid.includes('@broadcast') || message.key.remoteJid.endsWith('@g.us') || message.protocolMessage || phonesToFilter.includes(message.key.remoteJid)) {
                    continue;
                }

                const messageContent = message.message;
                let messageData = null;

                // --- Lógica principal de procesamiento de mensajes ---

                if (messageContent.conversation || messageContent.extendedTextMessage) {
                    messageData = { type: 'text', content: messageContent.conversation || messageContent.extendedTextMessage.text };
                
                } else if (messageContent.imageMessage) {
                    console.log('Recibida imagen. Descargando y subiendo a Cloudinary...');
                    const imageBuffer = await downloadMediaMessage(message, 'buffer', {});
                    const mediaUrl = await uploadMediaToCloudinary(imageBuffer);
                    messageData = { type: 'image', mediaUrl: mediaUrl, caption: messageContent.imageMessage.caption || null };
                
                } else if (messageContent.audioMessage) { // NUEVA SECCIÓN PARA AUDIO
                    console.log('Recibido audio. Descargando y subiendo a Cloudinary...');
                    const audioBuffer = await downloadMediaMessage(message, 'buffer', {});
                    const mediaUrl = await uploadMediaToCloudinary(audioBuffer);
                    messageData = { type: 'audio', mediaUrl: mediaUrl };

                } else if (messageContent.locationMessage) {
                    const location = messageContent.locationMessage;
                    messageData = { type: 'location', content: { latitude: location.degreesLatitude, longitude: location.degreesLongitude, name: location.name || null, address: location.address || null } };
                
                } else if (messageContent.contactMessage) {
                    const contact = messageContent.contactMessage;
                    messageData = { type: 'contact', contactInfo: { displayName: contact.displayName, vcard: contact.vcard } };
                
                } else if (messageContent.videoMessage) {
                    console.log('Mensaje de video ignorado.');
                    continue; 
                
                } else {
                    const unhandledType = Object.keys(messageContent)[0];
                    messageData = { type: 'unsupported', content: `[Tipo de mensaje no soportado: ${unhandledType}]` };
                }
                
                // Comprobar si es una respuesta (quote)
                const contextInfo = messageContent.extendedTextMessage?.contextInfo || messageContent.contextInfo;
                if (contextInfo?.quotedMessage && messageData) {
                    const quoted = contextInfo.quotedMessage;
                    let quotedContent = '';

                    if (quoted.conversation) { quotedContent = quoted.conversation; } 
                    else if (quoted.extendedTextMessage) { quotedContent = quoted.extendedTextMessage.text; } 
                    else if (quoted.imageMessage) { quotedContent = quoted.imageMessage.caption || '[Imagen]'; } 
                    else if (quoted.locationMessage) { quotedContent = quoted.locationMessage.name || '[Ubicación]'; }
                    else if (quoted.audioMessage) { quotedContent = '[Audio]'; } 
                    else { quotedContent = '[Mensaje no soportado]'; }
                    
                    messageData.quotedMessage = { id: contextInfo.stanzaId, senderJid: contextInfo.participant, content: quotedContent };
                }

                // Enviar al backend si hay datos
                if (messageData) {
                    const fullMessagePayload = {
                        ...messageData,
                        key: message.key,
                        messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                        pushName: message.pushName
                    };

                    await axios.post('http://34.44.100.213:3000/api/messages', { message: fullMessagePayload });
                    console.log(`Mensaje de tipo '${fullMessagePayload.type}' ${fullMessagePayload.quotedMessage ? '(con respuesta)' : ''} enviado al backend.`);
                }
            }
        } catch (error) {
            console.error('Error procesando el mensaje:', error);
        }
    })     
}

connectToWhatsApp()

const port = 8080
app.listen(port, () => {
    console.log(`Servidor Baileys escuchando en el puerto ${port}.`);
})