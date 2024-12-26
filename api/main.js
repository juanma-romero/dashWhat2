import {makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import { io } from 'socket.io-client';  // Importar socket.io-client

async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')    
    
    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state, 
        // can use Windows, Ubuntu here too
        //browser: Browsers.Windows('Desktop'),
        //syncFullHistory: true     
    })

    // maneja las credenciales
    sock.ev.on('creds.update', saveCreds)

        // Configurar conexión de WebSocket con el backend
    const socket = io('http://localhost:5000');  // Ajustar la URL según sea necesario

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        
        // Escuchar los eventos desde el backend para enviar mensajes a WhatsApp
        socket.on('send-whatsapp-message', async (msgData) => {
            try {
                const { remoteJid, message } = msgData;
                console.log(`Sending message to WhatsApp user: ${remoteJid}`);

                // Enviar mensaje a WhatsApp
                await sock.sendMessage(remoteJid, { text: message });
                console.log(`Message sent to ${remoteJid}: ${message}`);

            } catch (error) {
                console.error('Error sending message to WhatsApp:', error);
            }
        })
    })

        // Manjeo de la desconexión del Socket.IO
        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server')
        })

    // maneja la coneccion
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
    

    // maneja los mensajes
    sock.ev.on('messages.upsert', async m => {
        //console.log(JSON.stringify(m, undefined, 2))
    
        try {
            const message = m.messages[0]
            
            // Filtrar mensajes de 'status@broadcast' y mensajes de grupo
            if (!message || message.key.remoteJid === 'status@broadcast' || message.key.remoteJid.endsWith('@g.us')) {
                return  // Salir prematuramente si el mensaje es de un status broadcast o un grupo
            }
    
            // Solo procesa si el mensaje es entrante (no de tu bot)
            if (!message.key.fromMe) { 
                const sender = message.key.remoteJid
                const timestamp = message.messageTimestamp
                let textMessage = ""
    
                // Manejo de diferentes tipos de mensaje
                if (message.message && message.message.conversation) {
                    textMessage = message.message.conversation;
                } else if (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
                    textMessage = message.message.extendedTextMessage.text;
                }
    
                console.log('Remitente:', sender)
                console.log('Mensaje:', textMessage)
                console.log('Timestamp:', new Date(timestamp * 1000))
    
                // Reenviar datos esenciales al backend
                await axios.post('http://localhost:5000/api/messages', {
                    sender,
                    text: textMessage,
                    timestamp: new Date(timestamp * 1000).toISOString()
                })
                // Emitimos estos datos hacia el frontend a través del backend
                socket.emit('new-message', { sender, text: textMessage, timestamp })
            }
        } catch (error) {
            console.error('Error processing message:', error)
        }
    })
}
// run in main file
connectToWhatsApp()
