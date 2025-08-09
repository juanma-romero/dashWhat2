import 'dotenv/config'
import { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import FormData from 'form-data'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'

// --- Configuración de Cloudinary (sin cambios) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// --- Configuración para la API de Chatwoot ---
const chatwootConfig = {
  baseUrl: process.env.CHATWOOT_BASE_URL,
  accountId: process.env.CHATWOOT_ACCOUNT_ID,
  apiToken: process.env.CHATWOOT_API_TOKEN,
  inboxIdentifier: process.env.CHATWOOT_INBOX_IDENTIFIER,
  api: axios.create({
    baseURL: `${process.env.CHATWOOT_BASE_URL}/api/v1/accounts/${process.env.CHATWOOT_ACCOUNT_ID}`,
    headers: { 'api_access_token': process.env.CHATWOOT_API_TOKEN }
  })
};

// Caché en memoria para no buscar la conversación cada vez
const chatwootConversationCache = new Map();

const app = express()
app.use(express.json())
const phonesToFilter = JSON.parse(fs.readFileSync('./phones.json', 'utf-8')).phones;

async function uploadMediaToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
            if (error) { return reject(error); }
            resolve(result.secure_url);
        });
        uploadStream.end(buffer);
    });
}

// =================================================================
// --- NUEVA LÓGICA PARA CHATWOOT (MÉTODO API PÚBLICA) ---
// =================================================================
async function getOrCreateChatwootConversation(contact) {
    const contactIdentifier = contact.remoteJid.split('@')[0];

    // 1. Revisar la caché
    if (chatwootConversationCache.has(contactIdentifier)) {
        return chatwootConversationCache.get(contactIdentifier);
    }

    // 2. Buscar o crear el contacto en Chatwoot
    const { data: contactData } = await chatwootConfig.api.post('/contacts', {
        inbox_identifier: chatwootConfig.inboxIdentifier,
        name: contact.pushName || contactIdentifier,
        phone_number: `+${contactIdentifier}`
    });
    const contactId = contactData.payload.contact.id;
    
    // 3. Buscar o crear la conversación
    const { data: conversationData } = await chatwootConfig.api.post('/conversations', {
        inbox_id: contactData.payload.contact_inbox.inbox_id,
        contact_id: contactId,
        source_id: `whatsapp:${contactIdentifier}`
    });
    const conversationId = conversationData.id;

    // 4. Guardar en caché y devolver
    chatwootConversationCache.set(contactIdentifier, conversationId);
    return conversationId;
}

async function sendToChatwoot(message, messageData, mediaBuffer = null) {
    if (!chatwootConfig.apiToken) return;

    try {
        const conversationId = await getOrCreateChatwootConversation(message);

        // Formatear contenido (lógica sin cambios)
        let content = '';
        if (messageData.quotedMessage) { content += `> _${messageData.quotedMessage.content.replace(/\n/g, ' ')}_\n\n`; }
        // ... (resto de la lógica de formato de contenido)
        switch (messageData.type) {
            case 'text': content += messageData.content; break;
            case 'image': content += messageData.caption || 'Imagen adjunta'; break;
            case 'audio': content += 'Audio adjunto'; break;
            case 'location': const loc = messageData.content; content += `📍 **Ubicación:** ${loc.name || ''}\n[Ver mapa](https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude})`; break;
            case 'contact': content += `👤 **Contacto:** ${messageData.contactInfo.displayName}`; break;
            default: content += messageData.content || '[Mensaje no soportado]';
        }

        const messagePayload = {
            content: content,
            message_type: message.key.fromMe ? 'outgoing' : 'incoming',
            private: false
        };
        
        const url = `/conversations/${conversationId}/messages`;

        if (mediaBuffer) {
            const form = new FormData();
            form.append('content', messagePayload.content);
            form.append('message_type', messagePayload.message_type);
            const filename = messageData.type === 'audio' ? 'audio.ogg' : 'image.jpeg';
            form.append('attachments[]', mediaBuffer, { filename });
            await chatwootConfig.api.post(url, form, { headers: { ...form.getHeaders() } });
        } else {
            await chatwootConfig.api.post(url, messagePayload);
        }
        console.log(`Mensaje enviado a Chatwoot (Conversación ${conversationId})`);

    } catch (error) {
        console.error('Error al enviar a Chatwoot:', error.response ? error.response.data : error.message);
    }
}


async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
  const sock = makeWASocket({ auth: state })

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    // ... (sin cambios)
  });

  sock.ev.on('messages.upsert', async m => {
    // ... (toda la lógica de procesamiento y clasificación de mensajes es la misma)
    // Simplemente asegúrate de que al final, la llamada a sendToChatwoot se mantenga.
    try {
        for (const message of m.messages) {
          if (!message.key || !message.message || message.key.remoteJid.includes('@broadcast') || message.key.remoteJid.endsWith('@g.us') || message.protocolMessage || phonesToFilter.includes(message.key.remoteJid)) {
            continue;
          }
  
          const messageContent = message.message;
          let messageData = null;
          let mediaBuffer = null;
  
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
            // Enviar a tu backend (sin cambios)
            const fullMessagePayload = { ...messageData, key: message.key, messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(), pushName: message.pushName };
            await axios.post('http://34.44.100.213:3000/api/messages', { message: fullMessagePayload });
            console.log(`Mensaje guardado en tu backend para ${message.key.remoteJid}`);
  
            // Enviar a Chatwoot con el nuevo método
            await sendToChatwoot(message, fullMessagePayload, mediaBuffer);
          }
        }
      } catch (error) {
        console.error('Error procesando el mensaje:', error);
      }
  });
}

connectToWhatsApp();
const port = 8080;
app.listen(port, () => console.log(`Servidor Baileys escuchando en el puerto ${port}.`));