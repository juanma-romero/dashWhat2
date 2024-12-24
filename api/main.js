import {makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'

async function connectToWhatsApp () {

    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state,
        
    })
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
    sock.ev.on('creds.update', saveCreds)

    /*
    sock.ev.on('messages.upsert', async m => {

        console.log(JSON.stringify(m, undefined, 2))
        // accessing the key.remoteJid property directly might throw an error if it's undefined.  
        const remoteJid = m.messages[0].key.remoteJid
        if (remoteJid) {
            console.log('replying to', remoteJid);
            await sock.sendMessage(remoteJid, { text: 'Hello there!' })
        }

    })
        */
    sock.ev.on('messages.upsert', async m => {
        console.log(JSON.stringify(m, undefined, 2))
    
        try {
            if (!m.messages[0] || !m.messages[0].key || !m.messages[0].key.remoteJid) {
                // Handle cases where these are missing for some reason to prevent crashes
                console.warn('Incomplete message data:', JSON.stringify(m.messages[0]?.key));
                return; // Skip processing this message
            }
    
    
            const message = m.messages[0];
    
            // Check if the message is not from your bot (i.e., incoming message)
            if (!message.key.fromMe) {
                const remoteJid = message.key.remoteJid;  // Now safe to access
    
                console.log('replying to', remoteJid);
                await sock.sendMessage(remoteJid, { text: 'Hello there!' });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    
    })
}
// run in main file
connectToWhatsApp()
