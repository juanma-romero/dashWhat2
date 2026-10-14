/**
 * test_parser.js
 * Suite de pruebas local para verificar el parseo de mensajes de Baileys
 * sin conectar con WhatsApp.
 * 
 * Uso:
 *   node test_parser.js                  -> Solo ejecuta tests unitarios con aserciones
 *   node test_parser.js --send-backend   -> Además envía los payloads a BACKEND_URL (/api/messages)
 */

import { parseBaileysMessage, parseVCard, unwrapMessage } from './messageParser.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3100';
const SEND_TO_BACKEND = process.argv.includes('--send-backend');

const testCases = [
  {
    name: '1. Contacto individual (vCard estándar)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_CONTACT_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900000,
      message: {
        contactMessage: {
          displayName: 'Juan Perez',
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Perez;Juan;;;\nFN:Juan Perez\nTEL;type=CELL;waid=595981123456:+595 981 123456\nEND:VCARD`
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'contact') throw new Error(`Esperado type contact, obtenido: ${res.type}`);
      if (!res.content.includes('Juan Perez')) throw new Error(`El content no incluye el nombre: ${res.content}`);
      if (!res.content.includes('+595 981 123456') && !res.content.includes('+595981123456')) {
        throw new Error(`El content no incluye el teléfono: ${res.content}`);
      }
      if (!res.contactInfo || !res.contactInfo.displayName) throw new Error('Falta contactInfo');
    }
  },
  {
    name: '2. Múltiples contactos (contactsArrayMessage)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_CONTACTS_02' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900001,
      message: {
        contactsArrayMessage: {
          displayName: '2 contactos',
          contacts: [
            {
              displayName: 'Carlos Lopez',
              vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Carlos Lopez\nTEL;type=CELL;waid=595981999888:+595 981 999888\nEND:VCARD`
            },
            {
              displayName: 'Maria Gomez',
              vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Maria Gomez\nTEL;type=CELL;waid=595981777666:+595 981 777666\nEND:VCARD`
            }
          ]
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'contact') throw new Error(`Esperado type contact, obtenido: ${res.type}`);
      if (!res.content.includes('Carlos Lopez') || !res.content.includes('Maria Gomez')) {
        throw new Error(`El content no incluye los contactos: ${res.content}`);
      }
      if (!Array.isArray(res.contacts) || res.contacts.length !== 2) throw new Error('Falta array contacts');
    }
  },
  {
    name: '3. Reacción a un mensaje (reactionMessage con emoji)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_REACTION_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900002,
      message: {
        reactionMessage: {
          key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: true, id: 'MSG_PREV_123' },
          text: '👍',
          senderTimestampMs: 1728900002000
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'reaction') throw new Error(`Esperado type reaction, obtenido: ${res.type}`);
      if (res.content !== '[Reacción: 👍]') throw new Error(`Content inesperado: ${res.content}`);
      if (res.reaction?.targetMessageId !== 'MSG_PREV_123') throw new Error('Falta targetMessageId');
      if (res.reaction?.emoji !== '👍') throw new Error('Falta emoji');
    }
  },
  {
    name: '4. Sticker (stickerMessage)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_STICKER_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900003,
      message: {
        stickerMessage: {
          url: 'https://example.com/sticker.webp',
          mimetype: 'image/webp'
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'sticker') throw new Error(`Esperado type sticker, obtenido: ${res.type}`);
      if (res.content !== '[Sticker]') throw new Error(`Content inesperado: ${res.content}`);
    }
  },
  {
    name: '5. Documento (documentMessage - Comprobante PDF)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_DOC_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900004,
      message: {
        documentMessage: {
          fileName: 'comprobante_transferencia_12345.pdf',
          mimetype: 'application/pdf',
          caption: 'Acá está la seña del pedido'
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'document') throw new Error(`Esperado type document, obtenido: ${res.type}`);
      if (!res.content.includes('comprobante_transferencia_12345.pdf')) {
        throw new Error(`El content no incluye el fileName: ${res.content}`);
      }
      if (!res.content.includes('Acá está la seña')) {
        throw new Error(`El content no incluye el caption: ${res.content}`);
      }
    }
  },
  {
    name: '6. Video (videoMessage con caption)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_VID_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900005,
      message: {
        videoMessage: {
          caption: 'Miren cómo quedó la mesa decorada',
          seconds: 15
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'video') throw new Error(`Esperado type video, obtenido: ${res.type}`);
      if (!res.content.includes('Miren cómo quedó')) {
        throw new Error(`El content no incluye el caption: ${res.content}`);
      }
    }
  },
  {
    name: '7. Mensaje Efímero contenedor (ephemeralMessage envolviendo texto)',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_EPH_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900006,
      message: {
        ephemeralMessage: {
          message: {
            conversation: 'Hola, tengo mensajes que desaparecen activos'
          }
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'text') throw new Error(`Esperado type text desenvuelto, obtenido: ${res.type}`);
      if (res.content !== 'Hola, tengo mensajes que desaparecen activos') {
        throw new Error(`Content inesperado: ${res.content}`);
      }
    }
  },
  {
    name: '8. Mensaje con cita/respuesta citando un contacto',
    message: {
      key: { remoteJid: '595981111222@s.whatsapp.net', fromMe: false, id: 'MSG_QUOTE_01' },
      pushName: 'Cliente Ejemplo',
      messageTimestamp: 1728900007,
      message: {
        extendedTextMessage: {
          text: 'Llamale a este número por favor',
          contextInfo: {
            stanzaId: 'MSG_CONTACT_01',
            participant: '595981111222@s.whatsapp.net',
            quotedMessage: {
              contactMessage: {
                displayName: 'Juan Perez',
                vcard: 'BEGIN:VCARD\nFN:Juan Perez\nTEL;waid=595981123456:+595 981 123456\nEND:VCARD'
              }
            }
          }
        }
      }
    },
    validate: (res) => {
      if (res.type !== 'text') throw new Error(`Esperado type text, obtenido: ${res.type}`);
      if (!res.quotedMessage) throw new Error('Falta quotedMessage');
      if (!res.quotedMessage.content.includes('Juan Perez')) {
        throw new Error(`El quotedMessage no resolvió el contacto: ${res.quotedMessage.content}`);
      }
    }
  }
];

async function runTests() {
  console.log('====================================================');
  console.log('   PRUEBA LOCAL DE PARSEO DE MENSAJES (dashWhat2)   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  for (const t of testCases) {
    try {
      const parsed = await parseBaileysMessage(t.message, {
        downloadMedia: null,
        uploadMedia: null
      });

      if (!parsed) {
        throw new Error('parseBaileysMessage retornó null');
      }

      t.validate(parsed);

      console.log(`✅ [PASS] ${t.name}`);
      console.log(`   -> type: '${parsed.type}', content: "${parsed.content}"`);

      if (SEND_TO_BACKEND) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: parsed }),
            signal: AbortSignal.timeout(3000)
          });
          console.log(`   -> Enviado a backend (${BACKEND_URL}): HTTP ${res.status}`);
        } catch (postErr) {
          console.warn(`   ⚠️ Error enviando al backend (${BACKEND_URL}): ${postErr.message}`);
        }
      }

      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${t.name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('----------------------------------------------------');
  console.log(`Resultado: ${passed} pasados, ${failed} fallados.`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
