import { analyzeConversationForOrder as analyzeWithGemini } from './ia-service/gemini-service.js';

/**
 * Procesa una conversación para extraer y potencialmente registrar un pedido.
 * @param {string} remoteJid - El JID del chat.
 * @param {object} collection - La instancia de la colección de MongoDB 'chats'.
 * @returns {Promise<void>}
 */
export async function processOrderFromConversation(remoteJid, collection) {
  console.log(`[OrderProcessingService] Iniciando procesamiento de pedido para: ${remoteJid}`);
  try {
    // 1. Obtener el historial de la conversación
    const chatDocument = await collection.findOne({ remoteJid: remoteJid });

    if (!chatDocument) {
      console.log(`[OrderProcessingService] No se encontró historial de chat para: ${remoteJid}`);
      return;
    }

    // Extraer todos los mensajes del documento, ordenarlos por timestamp
    // y tomar los últimos 20.
    const allMessages = Object.values(chatDocument)
      .filter(value => typeof value === 'object' && value !== null && value.messageTimestamp && (value.content || value.caption)) // Asegurarse que sean mensajes con contenido textual
      .sort((a, b) => a.messageTimestamp - b.messageTimestamp);

    const last20Messages = allMessages.slice(-20);

    if (last20Messages.length === 0) {
        console.log(`[OrderProcessingService] No hay mensajes con contenido para analizar en el chat: ${remoteJid}`);
        return;
    }

    // 2. Formatear el historial para el prompt de Gemini
    const conversationHistoryForPrompt = last20Messages.map(msg => {
      const sender = msg.key && msg.key.fromMe ? "Vendedor" : (msg.pushName || "Cliente");
      const messageContent = msg.content || msg.caption || "[Mensaje multimedia sin texto descriptivo]";
      return `${sender}: ${messageContent}`;
    }).join("\n")

    // revisar la estructura de la conversacion de acuerdo a 
    // como se registra en mongo o como envia baileys la info

    console.log("\n[OrderProcessingService] --- Historial para Gemini ---");
    console.log(conversationHistoryForPrompt);
    console.log("[OrderProcessingService] --- Fin Historial ---\n");

    // 3. Llamar al servicio de Gemini para analizar la conversación
    const orderDetailsText = await analyzeWithGemini(conversationHistoryForPrompt);

    if (orderDetailsText) {
      console.log("[OrderProcessingService] Detalles del pedido (texto crudo) extraídos por Gemini:");
      console.log(orderDetailsText);
      try {
        const parsedOrder = JSON.parse(orderDetailsText);
        console.log("[OrderProcessingService] Detalles del pedido (JSON parseado):");
        console.log(parsedOrder);
        // AQUÍ IRÍA LA LÓGICA FUTURA:
        // - Validar `parsedOrder`.
        // - Guardar `parsedOrder` en una colección de 'pedidos' en la base de datos.
        // - Enviar una confirmación o realizar otras acciones.
      } catch (e) {
        console.error("[OrderProcessingService] La respuesta de Gemini no es un JSON válido:", orderDetailsText, e.message);
      }
    } else {
      console.log("[OrderProcessingService] Gemini no devolvió detalles del pedido o hubo un error en el servicio de Gemini.");
    }
  } catch (error) {
    console.error(`[OrderProcessingService] Error al procesar el pedido desde la conversación para ${remoteJid}:`, error);
  }
}