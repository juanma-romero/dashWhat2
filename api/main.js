import 'dotenv/config'
import { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import FormData from 'form-data' // <--- Nueva dependencia
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'

// --- Configuración de Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express()
app.use(express.json())
const phonesToFilter = JSON.parse(fs.readFileSync('./phones.json', 'utf-8')).phones;

// --- Funciones Helper ---

async function uploadMediaToCloudinary(buffer) {
  // ... (sin cambios)
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
      if (error) { return reject(error); }
      resolve(result.secure_url);
    });
    uploadStream.end(buffer);
  });
}

// =================================================================
// --- NUEVA FUNCIÓN PARA ENVIAR MENSAJES A CHATWOOT ---
// =================================================================
async function sendToChatwoot(message, messageData, mediaBuffer = null) {
  const chatwootUrl = process.env.CHATWOOT_WEBHOOK_URL;
  if (!chatwootUrl) return; // No hacer nada si la URL no está configurada

  try {
    // 1. Formatear el contacto
    const contactIdentifier = message.key.remoteJid.split('@')[0];
    const contactPayload = {
      name: message.pushName || contactIdentifier,
      phone_number: `+${contactIdentifier}`
    };

    // 2. Formatear el contenido del mensaje
    let content = '';
    // Si es una respuesta, añadir el texto citado al principio
    if (messageData.quotedMessage) {
        content += `> _${messageData.quotedMessage.content.replace(/\n/g, ' ')}_\n\n`;
    }

    switch (messageData.type) {
      case 'text':
        content += messageData.content;
        break;
      case 'image':
        content += messageData.caption || 'Imagen adjunta';
        break;
      case 'audio':
        content += 'Audio adjunto';
        break;
      case 'location':
        const loc = messageData.content;
        content += `📍 **Ubicación Compartida**\n*Nombre:* ${loc.name || 'N/A'}\n*Dirección:* ${loc.address || 'N/A'}\n[Ver en mapa](https://www.google.com/maps?q=${loc.latitude},${loc.longitude})`;
        break;
      case 'contact':
        content += `👤 **Contacto Compartido:**\n*Nombre:* ${messageData.contactInfo.displayName}\n*vCard Adjunta*`;
        break;
      default:
        content += messageData.content || '[Mensaje no soportado]';
    }

    // 3. Construir el payload del mensaje
    const messagePayload = {
      content: content,
      message_type: message.key.fromMe ? 'outgoing' : 'incoming',
      content_type: 'text' // Chatwoot maneja los adjuntos por separado
    };

    // 4. Enviar la petición
    if (mediaBuffer) {
      // Petición con archivo adjunto (multipart/form-data)
      const form = new FormData();
      form.append('payload', JSON.stringify({ contact: contactPayload, message: messagePayload }));
      
      const filename = messageData.type === 'audio' ? 'audio.ogg' : 'image.jpeg';
      form.append('attachments[]', mediaBuffer, { filename });
      
      await axios.post(chatwootUrl, form, { headers: { ...form.getHeaders() } });
    } else {
      // Petición de texto simple (JSON)
      await axios.post(chatwootUrl, { contact: contactPayload, message: messagePayload });
    }

    console.log(`Mensaje enviado a Chatwoot para ${contactIdentifier}`);

  } catch (error) {
    console.error('Error al enviar a Chatwoot:', error.response ? error.response.data : error.message);
  }
}


async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
  const sock = makeWASocket({ auth: state })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (update) => {
    // ... (sin cambios)
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

  // =================================================================
  // --- PROCESAMIENTO PRINCIPAL DE MENSAJES ---
  // =================================================================
  sock.ev.on('messages.upsert', async m => {
    try {
      for (const message of m.messages) {
        if (!message.key || !message.message || message.key.remoteJid.includes('@broadcast') || message.key.remoteJid.endsWith('@g.us') || message.protocolMessage || phonesToFilter.includes(message.key.remoteJid)) {
          continue;
        }

        const messageContent = message.message;
        let messageData = null;
        let mediaBuffer = null; // Variable para guardar el buffer del archivo

        // --- Clasificación del mensaje y descarga de medios ---
        if (messageContent.conversation || messageContent.extendedTextMessage) {
          messageData = { type: 'text', content: messageContent.conversation || messageContent.extendedTextMessage.text };
        } else if (messageContent.imageMessage) {
          mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
          const mediaUrl = await uploadMediaToCloudinary(mediaBuffer);
          messageData = { type: 'image', mediaUrl: mediaUrl, caption: messageContent.imageMessage.caption || null };
        } else if (messageContent.audioMessage) {
          mediaBuffer = await downloadMediaMessage(message, 'buffer', {});
          const mediaUrl = await uploadMediaToCloudinary(mediaBuffer);
          messageData = { type: 'audio', mediaUrl: mediaUrl };
        } else if (messageContent.locationMessage) {
          const loc = messageContent.locationMessage;
          messageData = { type: 'location', content: { latitude: loc.degreesLatitude, longitude: loc.degreesLongitude, name: loc.name || null, address: loc.address || null } };
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

        // Procesar mensajes citados (quotes)
        const contextInfo = messageContent.extendedTextMessage?.contextInfo || messageContent.contextInfo;
        if (contextInfo?.quotedMessage && messageData) {
          const quoted = contextInfo.quotedMessage;
          let quotedContent = '[Mensaje no soportado]';
          if (quoted.conversation) { quotedContent = quoted.conversation; }
          else if (quoted.extendedTextMessage) { quotedContent = quoted.extendedTextMessage.text; }
          else if (quoted.imageMessage) { quotedContent = quoted.imageMessage.caption || '[Imagen]'; }
          messageData.quotedMessage = { id: contextInfo.stanzaId, senderJid: contextInfo.participant, content: quotedContent };
        }

        if (messageData) {
          // --- Enviar a tu backend (sin cambios) ---
          const fullMessagePayload = {
            ...messageData,
            key: message.key,
            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
            pushName: message.pushName
          };
          await axios.post('http://34.44.100.213:3000/api/messages', { message: fullMessagePayload });
          console.log(`Mensaje guardado en tu backend para ${message.key.remoteJid}`);

          // --- Enviar a Chatwoot ---
          await sendToChatwoot(message, fullMessagePayload, mediaBuffer);
        }
      }
    } catch (error) {
      console.error('Error procesando el mensaje:', error);
    }
  })
}

connectToWhatsApp();

const port = 8080;
app.listen(port, () => {
  console.log(`Servidor Baileys escuchando en el puerto ${port}.`);
});