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
                    
                    if (message.message.conversation || (message.message.extendedTextMessage && message.message.extendedTextMessage.text)) {
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

                    
                    // Send to backend only once after messageData is populated
                    if (messageData) {
                        //await axios.post('https://backend-service-369596834111.us-central1.run.app/api/messages', { message: messageData });
                    await axios.post('http://34.44.100.213:3000/api/messages', { message: messageData });
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
