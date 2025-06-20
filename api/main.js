import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'

const app = express()
app.use(express.json())


async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')   

    const sock = makeWASocket({
        // can provide additional config here
         
        auth: state                  
    })

    // maneja las credenciales

    sock.ev.on('creds.update', saveCreds)         
    

    // maneja la coneccion de baileys
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            // as an example, this prints the qr code to the terminal
            console.log(await QRCode.toString(qr, {type:'terminal', small: true}))
        }
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('opened connection')
        }
    })    
    
    
    sock.ev.on('messages.upsert', async m => { 
        console.log(JSON.stringify(m, undefined, 2))
        // Import downloadMediaMessage if it's a separate utility, though usually it's on sock
        // const { downloadMediaMessage } = await import('@whiskeysockets/baileys'); // Or however it's imported if not on sock

        try {
            const messages = m.messages;
    
            for (const message of messages) {
                if (message && message.key && message.message) { // Check if message and key exist
                    const { remoteJid } = message.key
                    let messageData;

                    if (
                        remoteJid.includes('@broadcast') ||
                        remoteJid.endsWith('@g.us') ||
                        message.protocolMessage 
                    ) {
                        continue
                    }

                    // Helper function to parse vCard (basic version)
                    /*
                    const parseVCard = (vcard) => {
                        const nameMatch = vcard.match(/FN:(.+)/);
                        const waidMatch = vcard.match(/TEL;waid=([^:]+):(.+)/);
                        return {
                            displayName: nameMatch ? nameMatch[1].trim() : 'N/A',
                            phoneNumber: waidMatch ? waidMatch[1].trim() : 'N/A',
                            fullNumber: waidMatch ? waidMatch[2].trim() : 'N/A',
                        };
                    };
*/
                    // --- Handle Quoted Messages ---
                    /*
                    let quotedMsgInfo = null;
                    const contextInfo = message.message?.extendedTextMessage?.contextInfo || message.message?.imageMessage?.contextInfo || message.message?.contactMessage?.contextInfo || message.message?.contactsArrayMessage?.contextInfo || message.message?.locationMessage?.contextInfo || message.message?.audioMessage?.contextInfo;
                    
                    if (message.message.imageMessage) {
                        try {
                            // Correctly call downloadMediaMessage as a standalone function
                            const imageBuffer = await downloadMediaMessage(
                                message,
                                'buffer',
                                {}, // MediaDownloadOptions, can be empty
                                {   // MediaDownloadContext
                                    logger: sock.logger, // Pass the logger from the socket instance
                                    reuploadRequest: sock.updateMediaMessage // For handling re-uploads of old media
                                }
                            );
                            const base64Image = imageBuffer.toString('base64');
                            const imageMimeType = message.message.imageMessage.mimetype;
                            const imageDataUrl = `data:${imageMimeType};base64,${base64Image}`;

                            messageData = {
                                type: 'image',
                                key: message.key,
                                content: imageDataUrl,
                                caption: message.message.imageMessage.caption || '',
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        } catch (downloadError) {
                            console.error('Error downloading image:', downloadError);
                            // Optionally, send a placeholder or error message
                            messageData = {
                                type: 'text', // Fallback to text
                                key: message.key,
                                content: `[Image received, but failed to load: ${message.message.imageMessage.caption || ''}]`,
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        }
                    } else if (message.message.contactMessage) {
                        const vcard = message.message.contactMessage.vcard;
                        const parsedVCard = parseVCard(vcard);
                        messageData = {
                            type: 'contact',
                            key: message.key,
                            contactName: message.message.contactMessage.displayName || parsedVCard.displayName,
                            contactVcard: vcard, // Send the raw vCard for now, or send parsedVCard
                            contactInfo: parsedVCard,
                            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                            pushName: message.pushName
                        };
                    } else if (message.message.contactsArrayMessage) {
                        // For simplicity, we'll take the first contact if multiple are sent
                        // Or you could create a messageData for each contact or an array of contacts
                        const firstContact = message.message.contactsArrayMessage.contacts?.[0];
                        if (firstContact && firstContact.vcard) {
                            const parsedVCard = parseVCard(firstContact.vcard);
                            messageData = {
                                type: 'contact_array', // Differentiate if needed, or use 'contact'
                                key: message.key,
                                contactName: message.message.contactsArrayMessage.displayName || firstContact.displayName || parsedVCard.displayName,
                                contactVcard: firstContact.vcard,
                                contactInfo: parsedVCard, // Info of the first contact
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        } else {
                             messageData = { // Fallback if no contacts in array
                                type: 'text',
                                key: message.key,
                                content: `[Contact Array: ${message.message.contactsArrayMessage.displayName || 'Multiple Contacts'}]`,
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        }
                    } else if (message.message.audioMessage) {
                        try {
                            const audioBuffer = await downloadMediaMessage(
                                message,
                                'buffer',
                                {},
                                {
                                    logger: sock.logger,
                                    reuploadRequest: sock.updateMediaMessage
                                }
                            );
                            const base64Audio = audioBuffer.toString('base64');
                            const audioMimeType = message.message.audioMessage.mimetype;
                            const audioDataUrl = `data:${audioMimeType};base64,${base64Audio}`;

                            messageData = {
                                type: 'audio',
                                key: message.key,
                                content: audioDataUrl,
                                mimetype: audioMimeType,
                                duration: message.message.audioMessage.seconds,
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        } catch (downloadError) {
                            console.error('Error downloading audio:', downloadError);
                            messageData = {
                                type: 'text', // Fallback to text
                                key: message.key,
                                content: `[Audio received, but failed to load]`,
                                messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                                pushName: message.pushName
                            };
                        }
                    } else if (message.message.locationMessage) {
                        messageData = {
                            type: 'location',
                            key: message.key,
                            latitude: message.message.locationMessage.degreesLatitude,
                            longitude: message.message.locationMessage.degreesLongitude,
                            name: message.message.locationMessage.name || null,
                            address: message.message.locationMessage.address || null,
                            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                            pushName: message.pushName
                        };
                    } else if (message.message.conversation || (message.message.extendedTextMessage && message.message.extendedTextMessage.text)) {
                        const textMessage = message.message.conversation || message.message.extendedTextMessage.text;
                        messageData = {
                            type: 'text',
                            key: message.key,
                            content: textMessage,
                            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                            pushName: message.pushName
                        }
                    } else {
                        // Fallback for other unhandled message types for now
                        const unhandledType = Object.keys(message.message)[0];
                        console.log(`Unhandled message type: ${unhandledType}`);
                        messageData = {
                            type: 'unsupported',
                            key: message.key,
                            content: `[Unsupported message type: ${unhandledType}]`,
                            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                            pushName: message.pushName
                        }
                    }
*/
                    // Add quoted message info if it exists and messageData has been formed
                    /*
                    if (messageData && contextInfo && contextInfo.quotedMessage) {
                        let quotedContent = "[Non-text quoted message]";
                        if (contextInfo.quotedMessage.conversation) {
                            quotedContent = contextInfo.quotedMessage.conversation;
                        } else if (contextInfo.quotedMessage.extendedTextMessage?.text) {
                            quotedContent = contextInfo.quotedMessage.extendedTextMessage.text;
                        } else if (contextInfo.quotedMessage.imageMessage?.caption) {
                            quotedContent = `📷 ${contextInfo.quotedMessage.imageMessage.caption || 'Image'}`;
                        } else if (contextInfo.quotedMessage.imageMessage) {
                            quotedContent = `📷 Image`;
                        } else if (contextInfo.quotedMessage.audioMessage) {
                            quotedContent = `🎵 Audio`;
                        } else if (contextInfo.quotedMessage.locationMessage) {
                            quotedContent = `📍 Ubicación`;
                        }  // Add more types as needed: video, sticker etc.

                        messageData.quotedMessage = {
                            content: quotedContent,
                            senderJid: contextInfo.participant, // JID of the sender of the quoted message
                            id: contextInfo.stanzaId // ID of the quoted message
                        };
                    }
*/
                    // Send to backend only once after messageData is populated
                    if (messageData) {
                        //await axios.post('https://backend-service-369596834111.us-central1.run.app/api/messages', { message: messageData });
                    await axios.post('http://localhost:3000/api/messages', { message: messageData });
                    }
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    })   
    
   /* app.post('/send-message', async (req, res) => {
        try {
          const { remoteJid, message } = req.body; // Extract ONLY remoteJid and message text
    
          // Use Baileys to send the message.  The timestamp will be handled by Baileys.
          await sock.sendMessage(remoteJid, { text: message }); 
    
          res.status(200).send('Message sent successfully');
        } catch (error) {
          console.error('Error sending message:', error);
          res.status(500).send('Error sending message');
        }
    })*/
}
connectToWhatsApp()

const port = 8080
app.listen(port, () => {
    console.log(`Baileys server listening on port ${port}.`);
})
