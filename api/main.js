import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'

const app = express()
app.use(express.json())

// filtra los numeros de telefono de poveedores, amigos, etc. (solo guardamos mensajes de clientes)
const phonesToFilter = JSON.parse(fs.readFileSync('./phones.json', 'utf-8')).phones;

// Helper function para subir la imagen (implementación de ejemplo)
async function uploadImageAndGetUrl(buffer) {
    console.log('Simulating image upload...');
    const fileName = `uploads/image-${Date.now()}.jpeg`;
    if (!fs.existsSync('uploads')){
        fs.mkdirSync('uploads');
    }
    fs.writeFileSync(fileName, buffer);
    return `http://tu-servidor.com/${fileName}`;
}


async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')   

    const sock = makeWASocket({        
        auth: state                  
    })

    // maneja las credenciales
    sock.ev.on('creds.update', saveCreds)    

    // maneja la coneccion de baileys
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
                if (!message.key || !message.message || message.key.remoteJid.includes('@broadcast') || message.key.remoteJid.endsWith('@g.us') || message.protocolMessage || phonesToFilter.includes(message.key.remoteJid)) {
                    continue;
                }

                const messageContent = message.message;
                let messageData = null;

                // 1. Determinar el tipo y contenido principal del mensaje
                if (messageContent.conversation || messageContent.extendedTextMessage) {
                    messageData = {
                        type: 'text',
                        content: messageContent.conversation || messageContent.extendedTextMessage.text,
                    };
                } else if (messageContent.imageMessage) {
                    const imageBuffer = await downloadMediaMessage(message, 'buffer', {});
                    const imageUrl = await uploadImageAndGetUrl(imageBuffer);
                    // AJUSTE: Construir el payload como lo espera el backend
                    messageData = {
                        type: 'image',
                        mediaUrl: imageUrl,
                        caption: messageContent.imageMessage.caption || null
                    };
                } else if (messageContent.locationMessage) {
                    const location = messageContent.locationMessage;
                    messageData = {
                        type: 'location',
                        content: { // El backend guarda 'content' para ubicaciones, lo cual está bien
                            latitude: location.degreesLatitude,
                            longitude: location.degreesLongitude,
                            name: location.name || null,
                            address: location.address || null
                        }
                    };
                } else if (messageContent.contactMessage) {
                    const contact = messageContent.contactMessage;
                    // AJUSTE: Usar 'contactInfo' en lugar de 'content'
                    messageData = {
                        type: 'contact',
                        contactInfo: {
                            displayName: contact.displayName,
                            vcard: contact.vcard
                        }
                    };
                } else if (messageContent.videoMessage) {
                    console.log('Mensaje de video ignorado.');
                    continue; 
                } else {
                    const unhandledType = Object.keys(messageContent)[0];
                    messageData = {
                        type: 'unsupported',
                        content: `[Tipo de mensaje no soportado: ${unhandledType}]`,
                    };
                }
                
                // 2. Comprobar si es una respuesta (quote) y añadir la información
                const contextInfo = messageContent.extendedTextMessage?.contextInfo || messageContent.contextInfo;
                if (contextInfo?.quotedMessage) {
                    const quoted = contextInfo.quotedMessage;
                    let quotedContent = '';

                    if (quoted.conversation) {
                        quotedContent = quoted.conversation;
                    } else if (quoted.extendedTextMessage) {
                        quotedContent = quoted.extendedTextMessage.text;
                    } else if (quoted.imageMessage) {
                        quotedContent = quoted.imageMessage.caption || '[Imagen]';
                    } else if (quoted.locationMessage) {
                        quotedContent = quoted.locationMessage.name || '[Ubicación]';
                    } else {
                        quotedContent = '[Mensaje no soportado]';
                    }
                    
                    messageData.quotedMessage = {
                        id: contextInfo.stanzaId,
                        senderJid: contextInfo.participant,
                        content: quotedContent
                    };
                }

                // 3. Si se generó messageData, completarlo y enviarlo al backend
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