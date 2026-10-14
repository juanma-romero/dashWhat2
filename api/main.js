import 'dotenv/config' 
import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'
import { shouldIgnoreMessage, parseBaileysMessage } from './messageParser.js'

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

const getBackendMessagesUrl = () => {
    const raw = process.env.BACKEND_URL || 'http://backend:3000/api/messages';
    return raw.endsWith('/api/messages') ? raw : `${raw.replace(/\/+$/, '')}/api/messages`;
};

// Variable global para almacenar la conexión de Baileys
let sock = null;

// --- Función para Subir Medios a Cloudinary ---
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
    sock = makeWASocket({ auth: state })

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
                if (shouldIgnoreMessage(message, phonesToFilter)) {
                    continue;
                }

                const fullMessagePayload = await parseBaileysMessage(message, {
                    downloadMedia: (msg) => downloadMediaMessage(msg, 'buffer', {}),
                    uploadMedia: uploadMediaToCloudinary
                });

                // Enviar al backend si hay datos
                if (fullMessagePayload) {
                    const response = await axios.post(getBackendMessagesUrl(), { message: fullMessagePayload });

                    // Si el backend devuelve una respuesta (para comandos de administradores)
                    if (response.data && response.data.reply) {
                        console.log(`[main.js] El backend devolvió una respuesta, enviándola a ${response.data.targetJid}`);

                        // Enviar la respuesta usando nuestro propio endpoint
                        await axios.post('http://localhost:8880/send-message', {
                            jid: response.data.targetJid,
                            message: response.data.reply
                        });
                    }

                    console.log(`Mensaje de tipo '${fullMessagePayload.type}' ${fullMessagePayload.quotedMessage ? '(con respuesta)' : ''} enviado al backend.`);
                }

            }
        } catch (error) {
            console.error('Error procesando el mensaje:', error);
        }
    })
}

connectToWhatsApp()

// Endpoint para recibir respuestas del backend y enviarlas a WhatsApp
app.post('/send-message', async (req, res) => {
    try {
        const { jid, message } = req.body;

        if (!jid || !message) {
            return res.status(400).json({ error: 'Faltan parámetros: jid y message son requeridos' });
        }

        // Verificar que sock esté disponible
        if (!sock) {
            console.error('[main.js] sock no está disponible');
            return res.status(500).json({ error: 'Conexión de WhatsApp no disponible' });
        }

        console.log(`[main.js] Enviando respuesta a ${jid}: ${message.substring(0, 50)}...`);

        await sock.sendMessage(jid, { text: message });

        console.log(`[main.js] Respuesta enviada exitosamente a ${jid}`);
        res.json({ success: true, message: 'Mensaje enviado exitosamente' });

    } catch (error) {
        console.error('[main.js] Error enviando respuesta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

const port = 8880
app.listen(port, () => {
    console.log(`Servidor Baileys escuchando en el puerto ${port}.`);
})
