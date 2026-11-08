/**
 * main.js
 *
 * Servicio Baileys + Express para dashWhat2.
 * Maneja la conexión con WhatsApp Web, recepción y reenvío de mensajes al backend,
 * y endpoint HTTP para envío de mensajes salientes.
 *
 * Variables de entorno de logging:
 * - LOG_RAW_PAYLOADS=false: apaga la auditoría del sobre crudo de Baileys (rawPayloadLog.js).
 * - LOG_MESSAGES_READABLE=false: apaga la línea corta y legible por mensaje real (📩 entrante / 📤 saliente).
 */

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

// Último QR emitido por Baileys. Antes el evento `qr` solo logueaba una línea de texto y
// el string se descartaba: cuando WhatsApp desvinculaba el dispositivo (401 loggedOut) no
// había ninguna forma de escanear un código nuevo sin editar el código fuente.
let lastQr = { raw: null, png: null, at: null };

const AUTH_DIR = process.env.AUTH_DIR || "baileys_auth_info";
let sessionState = { invalid: false, lastDisconnect: null, authDirClears: 0, lastClearAt: null, fatalCloses: 0 };
const FATAL_DISCONNECT_CODES = new Set([DisconnectReason.loggedOut, DisconnectReason.badSession, DisconnectReason.multideviceMismatch]);

const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 5000);

const LOG_MESSAGES_READABLE = (process.env.LOG_MESSAGES_READABLE ?? "true") !== "false";
function maskJid(jid) { if (!jid) return "?"; const at = String(jid).indexOf("@"); const base = at === -1 ? String(jid) : String(jid).slice(0, at); const dom = at === -1 ? "" : String(jid).slice(at); if (base.length <= 7) return base + dom; return base.slice(0, 4) + "***" + base.slice(-3) + dom; }
function clip(texto, max = 120) { const t = String(texto ?? "").replace(/\s+/g, " ").trim(); return t.length > max ? t.slice(0, max) + "…" : t; }
function logMensaje(dir, jid, nombre, tipo, contenido) { if (!LOG_MESSAGES_READABLE) return; const flecha = dir === "in" ? "📩 entrante" : "📤 saliente"; const quien = [nombre, maskJid(jid)].filter(Boolean).join(" · "); console.log(`[main.js] ${flecha} · ${quien} · ${tipo} · "${clip(contenido)}"`); }

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

/**
 * Borra el contenido de AUTH_DIR para forzar una sesión nueva.
 *
 * OJO: AUTH_DIR es un BIND MOUNT en producción, así que borrar el directorio
 * falla siempre con EBUSY (`rmdir` sobre un punto de montaje) y —sin capturar—
 * tiraba el proceso Node entero (incidente 2026-11-08: 56 crashes en 24 h y el
 * contenedor reiniciando en bucle). Se borra SOLO el contenido, entrada por
 * entrada, y cualquier fallo se registra sin matar el servicio.
 *
 * @returns {number} cantidad de entradas borradas, o -1 si falló.
 */
function limpiarCredencialesDeSesion() {
    try {
        const entradas = fs.readdirSync(AUTH_DIR);
        for (const entrada of entradas) {
            fs.rmSync(`${AUTH_DIR}/${entrada}`, { recursive: true, force: true });
        }
        return entradas.length;
    } catch (err) {
        console.error('[main.js] No se pudo limpiar el contenido de las credenciales:', err.message);
        return -1;
    }
}

// Función principal para iniciar la conexión con Baileys
async function connectToWhatsApp() {
    const version = await resolveWaVersion();

    // Cargar o crear el estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // Crear el socket de Baileys
    sock = makeWASocket({
        auth: state,
        ...(version ? { version } : {}),
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });

    const currentSock = sock;

    // --- Fix upstream (Baileys #2858): el stanza <status> nunca se ackea ---
    // WhatsApp empezó a entregar los estados de los contactos como un stanza de nivel
    // superior <status>. Baileys rc.9 solo registra los handlers de message, call,
    // receipt, notification y ack,class:message, así que ese <status> NUNCA se ackea;
    // unos 50 minutos después el servidor cierra el stream reclamando justo ese ack
    // (`stream:error` con `ack class="status"`), lo que llega como
    // "Stream Errored (ack)" y se mapea a `badSession` (500). Al reconectar el servidor
    // reenvía el mismo <status> pendiente, no se ackea de nuevo y el ciclo se repite
    // para siempre: la sesión queda viva pero MUDA (incidente 2026-11-08, 56 crashes y
    // ~37 h sin mensajes). `sendMessageAck` ya arma lo correcto para este tag:
    // class='status' y conserva type/participant/recipient.
    currentSock.ws.on('CB:status', (node) => {
        currentSock.sendMessageAck(node).catch((err) => {
            console.error('[main.js] No se pudo ackear el stanza <status>:', err?.message || err);
        });
    });

    // Manejo de eventos de conexión
    currentSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            sessionState.invalid = false;
            lastQr = { raw: qr, png: null, at: new Date() };
            console.log('[main.js] Nuevo código QR recibido (sesión DESVINCULADA: hace falta escanear)');
            try {
                // 512px alcanza para escanear desde la pantalla y mantiene el payload chico.
                lastQr.png = await QRCode.toBuffer(qr, { type: 'png', width: 512, margin: 1 });
                console.log('[main.js] QR listo para escanear en GET /qr (o /qr.png para la imagen)');
            } catch (err) {
                console.error('[main.js] No se pudo renderizar el QR a PNG:', err.message);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const code = statusCode;
            const name = DisconnectReason[code] ?? "desconocido";
            sessionState.lastDisconnect = {
                code,
                name,
                reason: lastDisconnect?.error?.message ?? null,
                at: new Date().toISOString()
            };

            const fatal = FATAL_DISCONNECT_CODES.has(statusCode) || /conflict|badsession|logged ?out/i.test(String(lastDisconnect?.error?.message));

            if (fatal) {
                const now = Date.now();
                sessionState.fatalCloses++;
                const esLogoutReal = statusCode === DisconnectReason.loggedOut
                    || statusCode === DisconnectReason.multideviceMismatch;
                const puedeLimpiar = !sessionState.lastClearAt || (now - sessionState.lastClearAt >= 60000);
                // `badSession` / `conflict` suelen ser el bug #2858 (ack de <status>), NO
                // credenciales inválidas: limpiarlas forzaría un re-escaneo al pedo. Solo se
                // limpia con un logout real o si ya van 3 cierres fatales seguidos sin abrir.
                const limpiar = puedeLimpiar && (esLogoutReal || sessionState.fatalCloses >= 3);
                if (limpiar) {
                    console.log(`[main.js] SESION INVALIDA (code=${code} ${name}, cierre fatal #${sessionState.fatalCloses}): se limpian credenciales y se emitira un QR nuevo`);
                    const borradas = limpiarCredencialesDeSesion();
                    console.log(`[main.js] Credenciales limpiadas: ${borradas} entradas (AUTH_DIR=${AUTH_DIR}).`);
                    sessionState.authDirClears++;
                    sessionState.lastClearAt = now;
                    sessionState.invalid = true;
                } else {
                    console.log(`[main.js] Cierre fatal #${sessionState.fatalCloses} (code=${code} ${name}): se reconecta SIN limpiar credenciales.`);
                }
                setTimeout(connectToWhatsApp, RECONNECT_DELAY_MS);
            } else {
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`[main.js] Conexión cerrada. statusCode=${statusCode ?? 'n/d'} (${DisconnectReason[statusCode] ?? 'desconocido'}), motivo: ${lastDisconnect?.error?.message}, reconectando: ${shouldReconnect}`);
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, RECONNECT_DELAY_MS);
                }
            }
        } else if (connection === 'open') {
            sessionState.invalid = false;
            sessionState.fatalCloses = 0;
            // Ya vinculado: el QR deja de ser válido, no tiene sentido seguir sirviéndolo.
            lastQr = { raw: null, png: null, at: null };
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
                    logMensaje(msg.key?.fromMe ? "out" : "in", msg.key?.remoteJid, msg.pushName || fullMessagePayload.pushName || "", fullMessagePayload.type, fullMessagePayload.content);
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

// Endpoint para enviar mensajes de texto o multimedia (documentos, imágenes, etc.)
app.post('/send-message', async (req, res) => {
    const { jid, message, mediaUrl, mimetype, fileName } = req.body;

    if (!jid || (!message && !mediaUrl)) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos: jid y (message o mediaUrl) son obligatorios' });
    }
    if (!sock) {
        return res.status(503).json({ error: 'La sesión de WhatsApp todavía no está conectada' });
    }

    try {
        if (mediaUrl) {
            // Determinar tipo de adjunto
            let mediaPayload = {};
            const mime = mimetype || '';
            const caption = message || '';

            if (mime.includes('image')) {
                mediaPayload = { image: { url: mediaUrl }, caption };
            } else if (mime.includes('video')) {
                mediaPayload = { video: { url: mediaUrl }, caption };
            } else if (mime.includes('audio')) {
                mediaPayload = { audio: { url: mediaUrl }, mimetype: mime };
            } else {
                // Documento genérico (PDF, Word, etc.)
                mediaPayload = { document: { url: mediaUrl }, mimetype: mime || 'application/octet-stream', fileName: fileName || 'documento.pdf', caption };
            }

            await sock.sendMessage(jid, mediaPayload);
            logMensaje("out", jid, "", "media", message || mediaUrl);
            console.log(`[main.js] Archivo multimedia enviado exitosamente a ${jid} (mimetype: ${mime})`);
        } else {
            await sock.sendMessage(jid, { text: message });
            logMensaje("out", jid, "", "text", message);
            console.log(`[main.js] Mensaje enviado exitosamente a ${jid}`);
        }

        res.json({ success: true, message: 'Mensaje/adjunto enviado exitosamente' });
    } catch (error) {
        console.error('[main.js] Error enviando respuesta multimedia/texto:', error);
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

// --- Vinculación del teléfono (QR) ------------------------------------------
// Cuando el teléfono desvincula el dispositivo, Baileys cierra con 401 (loggedOut) y deja
// de reconectar. Para volver a vincular hay que vaciar baileys_auth_info y escanear un QR
// nuevo. Baileys rota el código cada ~20 s, así que /qr devuelve una página que se
// auto-refresca y /qr.png la imagen vigente en ese momento.
app.get('/qr.png', (req, res) => {
    if (!lastQr.png) {
        return res.status(409).json({ error: 'Todavía no hay QR: la sesión está conectada o Baileys aún no emitió uno' });
    }
    res.set('Cache-Control', 'no-store');
    res.type('png').send(lastQr.png);
});

app.get('/qr', (req, res) => {
    res.set('Cache-Control', 'no-store').type('html');
    if (!lastQr.raw) {
        return res.status(409).send(`<!doctype html><meta charset="utf-8"><title>dashwhat2</title>
<body style="font-family:system-ui;padding:2rem">
<h2>Sin QR por ahora</h2>
<p>La sesión está conectada, o Baileys todavía no emitió un código. Este endpoint sirve
cuando el dispositivo quedó desvinculado: hay que vaciar <code>baileys_auth_info</code> y reiniciar el servicio.</p>
<p><a href="/status">/status</a></p></body>`);
    }
    res.send(`<!doctype html><meta charset="utf-8">
<meta http-equiv="refresh" content="3"><title>Vincular WhatsApp — dashwhat2</title>
<body style="font-family:system-ui;padding:2rem;text-align:center">
<h2>Vincular WhatsApp</h2>
<p>En el teléfono: <b>WhatsApp → Dispositivos vinculados → Vincular un dispositivo</b></p>
<img src="/qr.png?ts=${lastQr.at.getTime()}" width="360" height="360" alt="Código QR">
<p style="color:#666">Emitido ${lastQr.at.toISOString()} · la página se refresca cada 3 s (el código rota)</p>
<p><a href="/status">/status</a></p></body>`);
});

app.get('/status', (req, res) => {
    res.json({
        connected: Boolean(sock?.user),
        hasQr: Boolean(lastQr.raw),
        qrAt: lastQr.at ? lastQr.at.toISOString() : null,
        sessionInvalid: sessionState.invalid,
        lastDisconnect: sessionState.lastDisconnect,
        authDirClears: sessionState.authDirClears,
        fatalCloses: sessionState.fatalCloses,
    });
});

// --- Redes de seguridad del proceso -----------------------------------------
// Un error no capturado en un handler de Baileys NO debe tumbar el servicio: antes
// el proceso moría, Docker lo reiniciaba y la sesión quedaba muda sin QR ni aviso
// (incidente 2026-11-08). Se registra fuerte y se sigue vivo.
process.on('uncaughtException', (err) => {
    console.error('[main.js] uncaughtException (el servicio sigue vivo):', err?.stack || err?.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[main.js] unhandledRejection (el servicio sigue vivo):', reason?.stack || reason?.message || reason);
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
