/**
 * rawPayloadLog.js
 *
 * Auditoría temporal del sobre CRUDO que entrega Baileys (Idea #20 / P0 del backlog).
 * Se llama en `main.js` ANTES de cualquier filtro (`phonesToFilter`, `shouldIgnoreMessage`,
 * `parseBaileysMessage`) para ver exactamente qué manda WhatsApp.
 *
 * Privacidad: el log NUNCA imprime contenido de mensajes ni datos personales.
 *  - se scrubbea el texto, caption, nombre, dirección y vCard (queda el largo)
 *  - los JIDs se enmascaran conservando prefijo/sufijo/dominio (suficiente para ver
 *    si llega `remoteJidAlt` y cómo se relaciona con `remoteJid`)
 *  - las coordenadas se redondean a ~1 km
 * Interesa la ESTRUCTURA y la PRESENCIA de campos, no los valores.
 *
 * Se desactiva con LOG_RAW_PAYLOADS=false. Con LOG_RAW_PAYLOADS_FULL=true se desactiva
 * el scrub (solo para una ventana corta de diagnóstico, a conciencia).
 */

const ON = process.env.LOG_RAW_PAYLOADS !== 'false';
const FULL = process.env.LOG_RAW_PAYLOADS_FULL === 'true';
const MAX_CHARS = Number(process.env.LOG_RAW_PAYLOADS_MAX || 4000);

// Claves cuyo valor NO debe imprimirse nunca: contenido de la conversación, datos
// personales o credenciales temporales de media (url/mediaKey/directPath del CDN: quien
// los tenga puede descargar el archivo adjunto).
const SCRUB_KEYS = new Set([
  // — contenido y datos personales —
  'text', 'conversation', 'caption', 'title', 'description', 'body', 'name', 'fileName',
  'displayName', 'businessName', 'pushName', 'notify', 'address', 'vcard', 'query',
  'preview', 'urlText', 'canonicalUrl', 'matchedText', 'jpegThumbnail', 'thumbnail',
  // — tokens de media / URLs que revelan la ubicación exacta —
  'url', 'directPath', 'mediaKey', 'mediaSignature', 'deviceStoreUrl',
]);

// Claves que SÍ se imprimen (estructura útil, no sensible): mimetype, fileLength, height,
// width, seconds, ptt, accuracy, stanzaId, addressingMode, key.id, etc. Los contenedores
// (contextInfo, quotedMessage) se recorren en vez de scrubbease: así se ve QUÉ campos hay
// y sus valores personales quedan scrubbeados por clave o enmascarados por patrón de JID.

const JID_KEYS = /jid$/i;
const LID_RE = /^(\d{3,})@([\w.-]+)$/;

const maskJid = (jid) => {
  if (typeof jid !== 'string') return jid;
  const m = jid.match(LID_RE);
  if (!m) return jid.includes('@') ? `?@${jid.split('@')[1]}` : jid;
  const d = m[1];
  const mid = d.length > 7 ? `***${d.slice(-2)}` : '***';
  return `${d.slice(0, 4)}${mid}@${m[2]} (${d.length}d)`;
};

const roundCoord = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);

/** Copia `value` aplicando scrub/mask según la clave por la que se llegó. */
const sanitize = (value, key) => {
  if (value === null || value === undefined) return value;

  if (FULL) return value;

  if (typeof value === 'string') {
    if (key && SCRUB_KEYS.has(key)) return `{scrub:len=${value.length}}`;
    // Cualquier valor con forma de JID se enmascara, llegue por la clave que llegue.
    if (LID_RE.test(value) || (key && JID_KEYS.test(key))) return maskJid(value);
    return value;
  }

  if (typeof value === 'number' && key && /latitude|longitude|degrees/i.test(key)) {
    return roundCoord(value);
  }

  if (Array.isArray(value)) return value.map((v) => sanitize(v, key));

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v, k);
    return out;
  }

  return value;
};

/**
 * Registra un evento crudo de Baileys en una sola línea parseable.
 * @param {string} evt - Nombre del evento (`messages.upsert`, `messages.update`, ...).
 * @param {any} data - El objeto tal como lo entregó Baileys.
 * @param {string|number} [which] - Identificador del mensaje dentro del lote.
 */
export function logRawEvent(evt, data, which = '') {
  if (!ON) return;

  let line;
  try {
    line = JSON.stringify(sanitize(data));
  } catch (err) {
    line = `{"unserializable":"${err.message}"}`;
  }
  if (line.length > MAX_CHARS) line = `${line.slice(0, MAX_CHARS)}…+${line.length - MAX_CHARS}c`;

  console.log(`[RAW-PAYLOAD] evt=${evt}${which === '' ? '' : ` which=${which}`} ${line}`);
}

export const auditEnabled = ON;

export default logRawEvent;
