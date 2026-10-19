/**
 * messageParser.js
 * Extracción, desenvolvimiento y normalización de mensajes de WhatsApp recibidos vía Baileys.
 */

/**
 * Desenvuelve mensajes contenedores de Baileys (efímeros, vista única, documentos con caption, etc.)
 * para llegar al contenido real del mensaje.
 * @param {Object} msg - El objeto message recibido de Baileys.
 * @returns {Object} - El objeto message desenvuelto.
 */
export function unwrapMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  let inner = msg;
  while (
    inner?.ephemeralMessage?.message ||
    inner?.viewOnceMessage?.message ||
    inner?.viewOnceMessageV2?.message ||
    inner?.viewOnceMessageV2Extension?.message ||
    inner?.documentWithCaptionMessage?.message ||
    inner?.editedMessage?.message?.protocolMessage?.editedMessage
  ) {
    inner =
      inner.ephemeralMessage?.message ||
      inner.viewOnceMessage?.message ||
      inner.viewOnceMessageV2?.message ||
      inner.viewOnceMessageV2Extension?.message ||
      inner.documentWithCaptionMessage?.message ||
      inner.editedMessage?.message?.protocolMessage?.editedMessage;
  }
  return inner;
}

/**
 * Parsea un vCard de WhatsApp y extrae el nombre y teléfono principal.
 * @param {string} vcard - Texto del vCard.
 * @returns {{ name: string, phone: string }}
 */
export function parseVCard(vcard) {
  if (!vcard || typeof vcard !== 'string') return { name: '', phone: '' };

  let name = '';
  let phone = '';

  const lines = vcard.split(/\r?\n/);
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('FN:')) {
      name = line.substring(3).trim();
    } else if (upper.startsWith('TEL')) {
      const waidMatch = line.match(/waid=(\d+)/i);
      if (waidMatch) {
        phone = '+' + waidMatch[1].trim();
      } else {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          phone = line.substring(colonIdx + 1).trim();
        }
      }
    }
  }

  if (!name) {
    const nLine = lines.find(l => l.toUpperCase().startsWith('N:'));
    if (nLine) {
      const parts = nLine.substring(2).split(';').map(p => p.trim()).filter(Boolean);
      name = parts.reverse().join(' ');
    }
  }

  return { name, phone };
}

/**
 * Extrae una representación en texto del mensaje citado (quotedMessage).
 * @param {Object} quotedRaw - Objeto quotedMessage de Baileys.
 * @returns {string} - Texto resumen.
 */
export function extractQuotedContent(quotedRaw) {
  if (!quotedRaw) return '';
  const quoted = unwrapMessage(quotedRaw);
  if (!quoted) return '';

  if (quoted.conversation) return quoted.conversation;
  if (quoted.extendedTextMessage?.text) return quoted.extendedTextMessage.text;
  if (quoted.imageMessage) return quoted.imageMessage.caption || '[Imagen]';
  if (quoted.videoMessage) return quoted.videoMessage.caption || '[Video]';
  if (quoted.audioMessage) return '[Audio]';
  if (quoted.documentMessage) return `[Documento: ${quoted.documentMessage.fileName || 'archivo'}]`;
  if (quoted.locationMessage || quoted.liveLocationMessage) {
    const loc = quoted.locationMessage || quoted.liveLocationMessage;
    return `[Ubicación: ${loc.name || loc.address || 'Ubicación'}]`;
  }
  if (quoted.contactMessage) {
    const { name, phone } = parseVCard(quoted.contactMessage.vcard);
    const displayName = quoted.contactMessage.displayName || name || 'Contacto';
    return `[Contacto: ${displayName}${phone ? ` (${phone})` : ''}]`;
  }
  if (quoted.contactsArrayMessage) {
    return '[Contactos compartidos]';
  }
  if (quoted.stickerMessage) return '[Sticker]';
  if (quoted.reactionMessage) return `[Reacción: ${quoted.reactionMessage.text || ''}]`;

  return '[Mensaje]';
}

/**
 * Evalúa si un mensaje debe ser ignorado por filtro de origen o protocolo.
 * @param {Object} message - WAMessage de Baileys.
 * @param {string[]} phonesToFilter - Lista de JIDs ignorados.
 * @returns {boolean}
 */
export function shouldIgnoreMessage(message, phonesToFilter = []) {
  if (!message || !message.key || !message.message) return true;
  const jid = message.key.remoteJid || '';
  if (
    jid.includes('@newsletter') ||
    jid.includes('@broadcast') ||
    jid.endsWith('@g.us') ||
    message.protocolMessage ||
    message.message?.protocolMessage ||
    phonesToFilter.includes(jid)
  ) {
    return true;
  }
  return false;
}

/**
 * Normaliza y procesa un mensaje entrante de Baileys.
 * @param {Object} message - Objeto WAMessage de Baileys.
 * @param {Object} [options]
 * @param {Function} [options.downloadMedia] - Función async (message) => buffer
 * @param {Function} [options.uploadMedia] - Función async (buffer) => url
 * @returns {Promise<Object|null>} - Objeto formateado para /api/messages o null si se ignora.
 */
export async function parseBaileysMessage(message, options = {}) {
  const { downloadMedia, uploadMedia } = options;
  if (!message || !message.message) return null;

  const key = message.key || {};
  const rawContent = message.message;
  const messageContent = unwrapMessage(rawContent);
  if (!messageContent) return null;

  let messageData = null;

  // 1. Textos comunes y extendidos
  if (messageContent.conversation || messageContent.extendedTextMessage) {
    const text = messageContent.conversation || messageContent.extendedTextMessage?.text || '';
    messageData = { type: 'text', content: text };
  }
  // 2. Imágenes
  else if (messageContent.imageMessage) {
    if (message.key?.fromMe) {
      console.log('[messageParser] Imagen propia ignorada.');
      return null;
    }
    let mediaUrl = null;
    if (downloadMedia && uploadMedia) {
      try {
        console.log('[messageParser] Recibida imagen. Descargando y subiendo a Cloudinary...');
        const imageBuffer = await downloadMedia(message);
        mediaUrl = await uploadMedia(imageBuffer);
      } catch (err) {
        console.error('[messageParser] Error procesando imagen:', err.message);
      }
    }
    const caption = messageContent.imageMessage.caption || null;
    messageData = {
      type: 'image',
      content: caption || '[Imagen]',
      mediaUrl: mediaUrl,
      caption: caption
    };
  }
  // 3. Audios
  else if (messageContent.audioMessage) {
    if (message.key?.fromMe) {
      console.log('[messageParser] Audio propio ignorado.');
      return null;
    }
    let mediaUrl = null;
    if (downloadMedia && uploadMedia) {
      try {
        console.log('[messageParser] Recibido audio. Descargando y subiendo a Cloudinary...');
        const audioBuffer = await downloadMedia(message);
        mediaUrl = await uploadMedia(audioBuffer);
      } catch (err) {
        console.error('[messageParser] Error procesando audio:', err.message);
      }
    }
    messageData = {
      type: 'audio',
      content: '[Audio]',
      mediaUrl: mediaUrl
    };
  }
  // 4. Ubicación (estática o en vivo)
  else if (messageContent.locationMessage || messageContent.liveLocationMessage) {
    const loc = messageContent.locationMessage || messageContent.liveLocationMessage;
    const name = loc.name || null;
    const address = loc.address || null;
    const desc = name || address || `${loc.degreesLatitude}, ${loc.degreesLongitude}`;
    messageData = {
      type: 'location',
      content: `[Ubicación: ${desc}]`,
      location: {
        latitude: loc.degreesLatitude,
        longitude: loc.degreesLongitude,
        name: name,
        address: address
      }
    };
  }
  // 5. Contacto único
  else if (messageContent.contactMessage) {
    const contact = messageContent.contactMessage;
    const { name, phone } = parseVCard(contact.vcard);
    const displayName = contact.displayName || name || 'Contacto';
    const label = phone ? `${displayName} (${phone})` : displayName;
    messageData = {
      type: 'contact',
      content: `[Contacto: ${label}]`,
      contactInfo: {
        displayName: displayName,
        phone: phone,
        vcard: contact.vcard
      }
    };
  }
  // 6. Lista de contactos (contactsArrayMessage)
  else if (messageContent.contactsArrayMessage) {
    const rawList = messageContent.contactsArrayMessage.contacts || [];
    const contacts = rawList.map(c => {
      const { name, phone } = parseVCard(c.vcard);
      const displayName = c.displayName || name || 'Contacto';
      return { displayName, phone, vcard: c.vcard };
    });
    const summary = contacts
      .map(c => `${c.displayName}${c.phone ? ` (${c.phone})` : ''}`)
      .join(', ');
    messageData = {
      type: 'contact',
      content: `[Contactos: ${summary || 'Compartidos'}]`,
      contacts: contacts
    };
  }
  // 7. Reacciones (emojis reaccionando a un mensaje previo)
  else if (messageContent.reactionMessage) {
    const reaction = messageContent.reactionMessage;
    const emoji = reaction.text || '';
    messageData = {
      type: 'reaction',
      content: emoji ? `[Reacción: ${emoji}]` : '[Reacción eliminada]',
      reaction: {
        targetMessageId: reaction.key?.id || null,
        targetRemoteJid: reaction.key?.remoteJid || null,
        emoji: emoji || null
      }
    };
  }
  // 8. Stickers
  else if (messageContent.stickerMessage) {
    messageData = {
      type: 'sticker',
      content: '[Sticker]'
    };
  }
  // 9. Documentos (PDF, recibos bancarios, comprobantes, etc.)
  else if (messageContent.documentMessage) {
    const doc = messageContent.documentMessage;
    const fileName = doc.fileName || 'documento';
    const caption = doc.caption ? ` - ${doc.caption}` : '';
    messageData = {
      type: 'document',
      content: `[Documento: ${fileName}${caption}]`,
      fileName: fileName,
      mimetype: doc.mimetype || null,
      caption: doc.caption || null
    };
  }
  // 10. Videos
  else if (messageContent.videoMessage) {
    if (message.key?.fromMe) {
      console.log('[messageParser] Video propio ignorado.');
      return null;
    }
    const caption = messageContent.videoMessage.caption ? ` ${messageContent.videoMessage.caption}` : '';
    messageData = {
      type: 'video',
      content: `[Video${caption}]`,
      caption: messageContent.videoMessage.caption || null
    };
  }
  // 11. Encuestas
  else if (
    messageContent.pollCreationMessage ||
    messageContent.pollCreationMessageV2 ||
    messageContent.pollCreationMessageV3
  ) {
    const poll =
      messageContent.pollCreationMessage ||
      messageContent.pollCreationMessageV2 ||
      messageContent.pollCreationMessageV3;
    messageData = {
      type: 'poll',
      content: `[Encuesta: ${poll.name || 'Sin título'}]`,
      pollName: poll.name
    };
  }
  // 12. Botones y listas interactivas
  else if (messageContent.buttonsResponseMessage) {
    const resp = messageContent.buttonsResponseMessage;
    const text = resp.selectedDisplayText || resp.selectedButtonId || 'Botón';
    messageData = {
      type: 'button_response',
      content: text
    };
  } else if (messageContent.templateButtonReplyMessage) {
    const resp = messageContent.templateButtonReplyMessage;
    const text = resp.selectedDisplayText || resp.selectedId || 'Botón';
    messageData = {
      type: 'button_response',
      content: text
    };
  } else if (messageContent.listResponseMessage) {
    const resp = messageContent.listResponseMessage;
    const text = resp.title || resp.singleSelectReply?.selectedRowId || 'Opción de lista';
    messageData = {
      type: 'list_response',
      content: text
    };
  }
  // Fallback para cualquier otro tipo no catalogado
  else {
    const unhandledType = Object.keys(messageContent)[0] || 'desconocido';
    messageData = {
      type: 'unsupported',
      content: `[Tipo de mensaje no soportado: ${unhandledType}]`,
      unhandledType: unhandledType
    };
  }

  // Quoted message (respuestas/citas a mensajes anteriores)
  const contextInfo =
    messageContent.extendedTextMessage?.contextInfo ||
    messageContent.imageMessage?.contextInfo ||
    messageContent.videoMessage?.contextInfo ||
    messageContent.documentMessage?.contextInfo ||
    messageContent.audioMessage?.contextInfo ||
    messageContent.contextInfo;

  if (contextInfo?.quotedMessage && messageData) {
    const quotedContent = extractQuotedContent(contextInfo.quotedMessage);
    messageData.quotedMessage = {
      id: contextInfo.stanzaId,
      senderJid: contextInfo.participant,
      content: quotedContent
    };
  }

  const ts = message.messageTimestamp;
  const isoDate = ts
    ? new Date(
        typeof ts === 'number' && ts < 10000000000 ? ts * 1000 : ts
      ).toISOString()
    : new Date().toISOString();

  return {
    ...messageData,
    key: message.key,
    messageTimestamp: isoDate,
    pushName: message.pushName || ''
  };
}
