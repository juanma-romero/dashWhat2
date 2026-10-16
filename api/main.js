import 'dotenv/config'
import {makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, fetchLatestWaWebVersion, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { v2 as cloudinary } from 'cloudinary'
import axios from 'axios'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'fs'
import { Readable } from 'stream'
import { shouldIgnoreMessage, parseBaileysMessage } from './messageParser.js'
import { logRawEvent } from './rawPayloadLog.js'

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

// El socket se guarda a nivel de módulo para que los endpoints se registren UNA sola
// vez (ver app.listen al final de este archivo).
let sock = null;

const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 5000);

const getBackendMessagesUrl = () => {
    const raw = process.env.BACKEND_URL || 'http://backend:3000/api/messages';
    return raw.endsWith('/api/messages') ? raw : `${raw.replace(/\/+$/, '')}/api/messages`;
};

const getBackendBaseUrl = () => {
    const raw = process.env.BACKEND_URL || 'http://backend:3000/api/messages';
    return raw.replace(/\/api\/messages\/?$/, '').replace(/\/+$/, '');
};

// URL con la que este servicio se llama a sí mismo para enviar. Antes estaba
// hardcodeada a localhost:8880 dentro del handler de upsert.
const getSelfSendMessageUrl = () => {
    const raw = process.env.SELF_URL || 'http://localhost:8880';
    return `${raw.replace(/\/+$/, '')}/send-message`;
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

/**
 * Sube un buffer de media a Cloudinary. Usa upload_stream (no data-uri) para servir
 * cualquier mimetype: los audios de WhatsApp son ogg/opus y un prefijo de imagen los
 * corrompería.
 */
function uploadBufferToCloudinary(buffer, mimetype) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'voraz_chats', resource_type: 'auto' },
            (error, result) => (error ? reject(error) : resolve(result.secure_url))
        );
        Readable.from(buffer).pipe(stream);
    });
}

/**
 * Resuelve la versión de WhatsApp Web en vivo. Se degrada con ruido en el log en vez de
 * matar el proceso: si `fetchLatestWaWebVersion()` falla (red, GitHub, manifest), antes
 * el rechazo sin capturar tiraba el arranque y el servicio quedaba caído en silencio.
 */
async function resolveWaVersion() {
    try {
        const { version, isLatest } = await fetchLatestWaWebVersion();
        console.log(`[main.js] Conectando con versión de WhatsApp Web: ${version.join('.')} (latest: ${isLatest})`);
        return version;
    } catch (err) {
        console.warn('[main.js] fetchLatestWaWebVersion falló:', err.message);
    }
    try {
        const { version } = await fetchLatestBaileysVersion();
        console.warn(`[main.js] Fallback a fetchLatestBaileysVersion: ${version.join('.')}`);
        return version;
    } catch (err) {
        console.error('[main.js] No se pudo resolver la versión; uso la default de la librería:', err.message);
        return undefined;
    }
}

// Función principal para iniciar la conexión con Baileys
async function connectToWhatsApp() {
    const version = await resolveWaVersion();

    // Cargar o crear el estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    // Crear el socket de Baileys
    sock = makeWASocket({
        auth: state,
        ...(version ? { version } : {}),
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });

    const currentSock = sock;

    // Manejo de eventos de conexión
    currentSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[main.js] Nuevo código QR recibido (sesión DESVINCULADA: hace falta escanear)');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[main.js] Conexión cerrada. statusCode=${statusCode ?? 'n/d'} (${DisconnectReason[statusCode] ?? 'desconocido'}), motivo: ${lastDisconnect?.error?.message}, reconectando: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, RECONNECT_DELAY_MS);
            }
        } else if (connection === 'open') {
            console.log('[main.js] Conexión abierta exitosamente con WhatsApp');
        }
    });

    // Guardar credenciales actualizadas
    currentSock.ev.on('creds.update', saveCreds);

    // Manejo de mensajes entrantes
    currentSock.ev.on('messages.upsert', async (m) => {
        // AUDITORÍA P0 (backlog, Idea #20): el sobre CRUDO tal como lo entrega Baileys,
        // antes de cualquier filtro y antes de parsear. No imprime contenido del mensaje
        // ni tokens de media; los JIDs van enmascarados. Se apaga con LOG_RAW_PAYLOADS=false.
        logRawEvent('messages.upsert', { batchType: m.type, count: m.messages?.length ?? 0 });

        if (m.type !== 'notify') {
            // Los lotes que no son 'notify' (p. ej. 'append' del sync de historial) no se
            // procesan, pero SÍ se auditan: son los que traen el mapeo LID <-> teléfono.
            (m.messages || []).forEach((msg, i) => logRawEvent('messages.upsert', msg, `${i}/${m.type}`));
            return;
        }

        for (const [i, msg] of (m.messages || []).entries()) {
            logRawEvent('messages.upsert', msg, `${i}/${m.type}`);

            const senderJid = msg.key.remoteJid;
            const senderPhone = senderJid ? senderJid.split('@')[0] : '';

            // Ignorar números filtrados
            if (phonesToFilter.includes(senderPhone) || phonesToFilter.includes(senderJid)) {
                console.log(`[main.js] Ignorando mensaje de remitente filtrado: ${senderPhone || senderJid}`);
                continue;
            }

            // La firma es shouldIgnoreMessage(message, phonesToFilter). Sin el segundo
            // argumento el chequeo de JIDs filtrados de adentro no corría nunca.
            if (shouldIgnoreMessage(msg, phonesToFilter)) {
                continue;
            }

            try {
                // parseBaileysMessage espera un objeto de opciones
                // ({ downloadMedia, uploadMedia }). Llamado con argumentos posicionales,
                // options quedaba vacío y la media (audio/imagen) se subía nunca: el
                // `if (downloadMedia && uploadMedia)` del parser la salteaba en silencio.
                const fullMessagePayload = await parseBaileysMessage(msg, {
                    downloadMedia: (message) => downloadMediaMessage(message),
                    uploadMedia: (buffer, mimetype) => uploadBufferToCloudinary(buffer, mimetype),
                });

                if (fullMessagePayload) {
                    const response = await axios.post(getBackendMessagesUrl(), { message: fullMessagePayload });
                    if (response.data && response.data.reply) {
                        console.log(`[main.js] El backend devolvió una respuesta, enviándola a ${response.data.targetJid}`);
                        await axios.post(getSelfSendMessageUrl(), {
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

    // Las reacciones y las ediciones de mensaje llegan por ESTE evento, no por
    // messages.upsert: hoy el stack no las veía. Solo se registran (no cambian el flujo).
    currentSock.ev.on('messages.update', (updates) => {
        logRawEvent('messages.update', updates);
    });
}

// Endpoint para enviar mensajes
app.post('/send-message', async (req, res) => {
    const { jid, message } = req.body;

    if (!jid || !message) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos: jid y message son obligatorios' });
    }
    if (!sock) {
        return res.status(503).json({ error: 'La sesión de WhatsApp todavía no está conectada' });
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

// El listen vive FUERA de connectToWhatsApp: adentro, cada reconexión volvía a pedir el
// puerto (EADDRINUSE sin capturar) y acumulaba un setInterval nuevo por ciclo.
const port = 8880;
app.listen(port, () => {
    console.log(`Servidor Baileys escuchando en el puerto ${port}.`);
    connectToWhatsApp();
    syncPhonesFromBackend();
    setInterval(syncPhonesFromBackend, 10 * 60 * 1000);
});
