import {makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import axios from 'axios'
import { io } from 'socket.io-client'

async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')    
    
    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state             
    })

    // maneja las credenciales
    sock.ev.on('creds.update', saveCreds)

    // Configurar conexión de WebSocket con el backend
    const socket = io('http://localhost:5000')

    // Manjeo de la desconexión del Socket.IO
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server')
    })

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        
        // Escuchar los eventos originados por frontend, para enviar mensajes desde Voraz hacia >whatsapp>cliente
        socket.on('send-whatsapp-message', async (msgData) => {
            try {
                const { remoteJid, message } = msgData;
                //console.log(`Sending message to WhatsApp user: ${remoteJid}`);

                // Enviar mensaje a WhatsApp
                await sock.sendMessage(remoteJid, { text: message });
                //console.log(`Message sent to ${remoteJid}: ${message}`);

            } catch (error) {
                console.error('Error sending message to WhatsApp:', error);
            }
        })
    })
    
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

    // maneja los mensajes: recibidos desde Baileys/Whatsapp y envia a Frontend (con socket.io y axios dentro de websocket-baileys)
    // recibe los mensajes desde front y los envia a what??
    sock.ev.on('messages.upsert', async m => {
        //console.log(JSON.stringify(m, undefined, 2))
    
        try {
            const message = m.messages[0]            
            // Filtrar mensajes de 'status@broadcast' y mensajes de grupo
            if (!message || message.key.remoteJid === 'status@broadcast' || message.key.remoteJid.endsWith('@g.us')) {
                return  // Salir prematuramente si el mensaje es de un status broadcast o un grupo
            }     
            // Reenvia 'message' al backend para usar en db
            await axios.post('http://localhost:5000/api/messages', {message})
            // Emitimos 'message' al backend con websocket
            socket.emit('new-message-from-whatsapp', { message })
        }
        catch (error) {
            console.error('Error processing message:', error)
        }
    })
}

connectToWhatsApp()
