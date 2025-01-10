import {makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import express from 'express'

const app = express()
app.use(express.json())

async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')   

    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state                  
    })

    // maneja las credenciales

    sock.ev.on('creds.update', saveCreds)         
    

    // maneja la coneccion de baileys
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
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
        try {
            const messages = m.messages;
    
            for (const message of messages) {
                if (message && message.key && message.message) { // Check if message and key exist
                    const { remoteJid } = message.key
                    let textMessage
    
                    if (message.message.conversation) {
                        textMessage = message.message.conversation;
                    } else if (message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
                        textMessage = message.message.extendedTextMessage.text
                    }
    
                    // Proceed only if textMessage is defined (it's a text message)
                    if (textMessage) {
                        if (
                            remoteJid.includes('@broadcast') ||
                            remoteJid.endsWith('@g.us') ||
                            message.protocolMessage // Filter out protocol messages
                        ) {
                            continue
                        }
    

                        const messageData = {
                            key: message.key,
                            message: textMessage,
                            messageTimestamp: new Date(message.messageTimestamp * 1000).toISOString(),
                            pushName: message.pushName,
                        }    
                        await axios.post('http://localhost:5000/api/messages', { message: messageData })                      
                    }
                }

            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    })   

    app.post('/send-message', async (req, res) => {
        try {
          const { remoteJid, message } = req.body; // Extract ONLY remoteJid and message text
    
          // Use Baileys to send the message.  The timestamp will be handled by Baileys.
          await sock.sendMessage(remoteJid, { text: message }); 
    
          res.status(200).send('Message sent successfully');
        } catch (error) {
          console.error('Error sending message:', error);
          res.status(500).send('Error sending message');
        }
    })
}
connectToWhatsApp()

const port = 3000
app.listen(port, () => {
    console.log(`Baileys server listening on port ${port}`)
})
