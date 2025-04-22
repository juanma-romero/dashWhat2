import { collection } from '../index.js'
import {GoogleGenAI} from '@google/genai';
import dotenv from 'dotenv'


dotenv.config()

// Function to send the conversation to Gemini and get a response
async function generateGeminiResponse(conversation, context, diaActual) {
    // Access your API key as an environment variable (recommended)
    const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})
  
    // For text-only input, use the gemini-pro model
    //const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
    // Build the prompt with context and conversation
    const prompt = `
    ${context}
    ${diaActual}
    Conversation:
    ${conversation}
  
   Proporcione una respuesta útil e informativa basada en el contexto y la conversación.
    `;
  
    try {      
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
      })
      
      console.log(response.text)      
      return response
    } catch (error) {
      console.error("Error generating Gemini response:", error);
      return "An error occurred while generating the response.";
    }
  }

export async function llamaApi(remoteJid) {
    try {
        console.log('Fetching messages from last 24 hours for', remoteJid);

        // Find the document with the specified remoteJid
        const document = await collection.findOne({ remoteJid: remoteJid });

        if (!document) {
            console.log('No document found for', remoteJid);
            return []
        }

        // Extract message properties (assuming they are all objects that are not _id or remoteJid or stateConversation)
        const messageKeys = Object.keys(document)
            .filter(key => key !== '_id' && key !== 'remoteJid' && key !== 'stateConversation' && typeof document[key] === 'object');

        // Map the message keys to their corresponding message objects, ensuring properties exist
        const messages = messageKeys.map(key => {
          const messageObject = document[key];
          return {
            key: key,
            message: messageObject.message || null,
            messageTimestamp: messageObject.messageTimestamp || null,
            pushName: messageObject.pushName || null
          };
        }).filter(message => message.messageTimestamp !== null); //Filter out null messageTimestamp

        // Calculate the timestamp for 12 hours ago
        const twelveFourHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        // Filter messages to include only those from the last 12 hours
        const recentMessages = messages.filter(message => {
            const messageDate = new Date(message.messageTimestamp);
            return messageDate >= twelveFourHoursAgo;
        });

        // Get the current date in a readable format
        const currentDate = new Date().toLocaleDateString('es-AR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
      });

         // Format the conversation for Gemini
        const conversationText = recentMessages
            .map(message => `${message.pushName || 'Unknown'}: ${message.message}`)
            .join('\n');

        // context
        const context =             
            `Objetivo: Eres un asistente experto en analizar conversaciones de WhatsApp para extraer detalles de pedidos realizados a la empresa Voraz (hacemos bocaditos salados, tambien llamados lunch para reuniones, cumpleaños etc)
            La Tarea Específica:  Analiza la siguiente conversación entre un Cliente y un Agente de Voraz. Tu objetivo es identificar y extraer la información clave del pedido confirmado.
            Los Datos a Extraer: Busca específicamente:
              *  dia_entrega: El día de entrega (formato DD-MM-YY). Resuelve referencias relativas como "mañana" basándote en la fecha de la conversación.
              *  hora_entrega: La hora de entrega (formato HH:MM).
              *  productos: Una lista de objetos, donde cada objeto tenga "nombre" y "cantidad".
              *  delivery: pide que se le envie el pedido x delivery o pasa a retirar por el local
              *  forma_pago: La forma de pago mencionada (opciones: 'Transferencia' o 'Efectivo'...algun cliente puede responder 'banco', 'dinero', 'pago aca' debes descifrar si es posible la intencion o solo copiar lo que el cliente dice).           
            Formato de Salida Deseado: Devuelve la información extraída ÚNICAMENTE en formato JSON válido. Si algún dato no se encuentra explícitamente en la conversación, usa 'No especificado' para ese campo en el JSON. No incluyas explicaciones adicionales fuera del JSON`
        
        const diaActual = `Fecha de la conversación: ${currentDate}`

            // Get the Gemini response
        console.log('context: ', context, 'diaActual:', diaActual, 'conversation:', conversationText)
        generateGeminiResponse(conversationText, context, diaActual)
        
        return

    } catch (error) {
        console.error('Error fetching messages:', error);
        return []
    }
}


