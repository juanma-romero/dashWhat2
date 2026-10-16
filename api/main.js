import 'dotenv/config' 
import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, fetchLatestWaWebVersion } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'
import { shouldIgnoreMessage, parseBaileysMessage } from './messageParser.js'

// --- Configuración de Cloudinary ---
// Lee las credenciales de forma segura desde el archivo .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express();
app.use(express.json());

let phonesToFilter = [];
try {
    phonesToFilter = JSON.parse(fs.readFileSync('./phones.json', 'utf-8')).phones || [];
} catch (e) {
    console.warn('[main.js] No se pudo leer phones.json inicial:', e.message);
}

const getBackendMessagesUrl = () => {
    const raw = process.env.BACKEND_URL || 'http://backend:3000/api/messages';
    return raw.endsWith('/api/messages') ? raw : `${raw.replace(/\/+$/, '')}/api/messages`;
};

const getBackendBaseUrl = () => {
    const raw = process.env.BACKEND_URL || 'http://backend:3000/api/messages';
    return raw.replace(/\/api\/messages\/?$/, '').replace(/\/+$/, '');
};

/**
 * Sincroniza dinámicamente la lista de teléfonos y JIDs a ignorar desde el backend (MongoDB)
 */
async function syncPhonesFromBackend() {
    try {
        const url = `${getBackendBaseUrl()}/api/filtered-contacts/active-jids`;
        const res = await axios.get(url, { timeout: 3000 });
        if (res.data && Array.isArray(res.data.jids)) {
            const combined = new Set([...phonesToFilter, ...res.data.jids, ...(res.data.phones || [])]);
            phonesToFilter = Array.from(combined);
            console.log(`[main.js] Filtros de contactos sincronizados con backend (${phonesToFilter.length} identificadores activos).`);
        }
    } catch (err) {
        console.warn('[main.js] No se pudo sincronizar filtros con backend (se mantiene lista local):', err.message);
    }
}

// Función principal para iniciar la conexión con Baileys
async function connectToWhatsApp() {
    // Obtenemos la última versión de WhatsApp Web
    const { version, isLatest } = await fetchLatestWaWebVersion();
    console.log(`[main.js] Conectando con versión de WhatsApp Web: ${version.join('.')}`);

    // Cargar o crear el estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    // Crear el socket de Baileys
    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });

    // Manejo de eventos de conexión
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[main.js] Nuevo código QR recibido');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[main.js] Conexión cerrada debido a: ${lastDisconnect?.error?.message}, reconectando: ${shouldReconnect}`);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[main.js] Conexión abierta exitosamente con WhatsApp');
        }
    });

    // Guardar credenciales actualizadas
    sock.ev.on('creds.update', saveCreds);

    // Manejo de mensajes entrantes
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            // Ignorar mensajes enviados por el bot o duplicados
            if (msg.key.fromMe) continue;

            const senderJid = msg.key.remoteJid;
            const senderPhone = senderJid ? senderJid.split('@')[0] : '';

            // Ignorar números filtrados
            if (phonesToFilter.includes(senderPhone) || phonesToFilter.includes(senderJid)) {
                console.log(`[main.js] Ignorando mensaje de remitente filtrado: ${senderPhone || senderJid}`);
                continue;
            }

            if (shouldIgnoreMessage(msg)) {
                continue;
            }

            try {
                const fullMessagePayload = await parseBaileysMessage(msg, sock, downloadMediaMessage, cloudinary);

                if (fullMessagePayload) {
                    const response = await axios.post(getBackendMessagesUrl(), { message: fullMessagePayload });
                    if (response.data && response.data.reply) {
                        console.log(`[main.js] El backend devolvió una respuesta, enviándola a ${response.data.targetJid}`);
                        await axios.post('http://localhost:8880/send-message', {
                            jid: response.data.targetJid,
                            message: response.data.reply
                        });
                    }
                }
            } catch (err) {
                console.error('[main.js] Error procesando mensaje de Baileys:', err.message);
            }
        }
    });

    // Endpoint para enviar mensajes
    app.post('/send-message', async (req, res) => {
        const { jid, message } = req.body;

        if (!jid || !message) {
            return res.status(400).json({ error: 'Faltan parámetros requeridos: jid y message son obligatorios' });
        }

        try {
            await sock.sendMessage(jid, { text: message });
            console.log(`[main.js] Respuesta enviada exitosamente a ${jid}`);
            res.json({ success: true, message: 'Mensaje enviado exitosamente' });
        } catch (error) {
            console.error('[main.js] Error enviando respuesta:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    // Endpoint para forzar la recarga dinámica de filtros desde el backend
    app.post('/reload-filters', async (req, res) => {
        try {
            await syncPhonesFromBackend();
            res.json({ success: true, count: phonesToFilter.length });
        } catch (error) {
            console.error('[main.js] Error recargando filtros:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const port = 8880;
    app.listen(port, () => {
        console.log(`Servidor Baileys escuchando en el puerto ${port}.`);
        syncPhonesFromBackend();
        setInterval(syncPhonesFromBackend, 10 * 60 * 1000);
    });
}

connectToWhatsApp();
