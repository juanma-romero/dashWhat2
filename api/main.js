import {makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'

const app = express()
app.use(express.json())

let qrCodeDataUrl = null; // Variable to store QR code data URL

async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')   

    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: false, // Changed to false
        auth: state                  
    })

    // maneja las credenciales

    sock.ev.on('creds.update', saveCreds)         
    

    // maneja la coneccion de baileys
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            qrCodeDataUrl = await QRCode.toDataURL(qr);
            console.log('QR code generated. Scan it at http://localhost:8080/qr');
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
                            pushName: message.pushName
                        }    
                        await axios.post('http://localhost:5000/api/messages', { message: messageData })                      
                    }
                }

            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    })   

    app.get('/qr', (req, res) => {
        if (qrCodeDataUrl) {
            res.send(`
                <html>
                    <head>
                        <title>WhatsApp QR Code</title>
                        <style>
                            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
                            img { max-width: 100%; max-height: 100%; }
                        </style>
                    </head>
                    <body>
                        <img src="${qrCodeDataUrl}" alt="WhatsApp QR Code" />
                    </body>
                </html>
            `);
        } else {
            res.status(404).send(`
                <html>
                    <head><title>QR Code Not Ready</title></head>
                    <body>
                        <h1>QR code is not available yet.</h1>
                        <p>Please wait for the QR code to be generated and refresh this page.</p>
                        <script>setTimeout(() => window.location.reload(), 5000);</script>
                    </body>
                </html>
            `);
        }
    });

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

const port = 8080; // Changed port
app.listen(port, () => {
    console.log(`Baileys server listening on port ${port}. QR code will be available at http://localhost:${port}/qr`);
})
