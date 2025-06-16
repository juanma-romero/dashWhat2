import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("[GeminiService] GEMINI_API_KEY no está configurada en el archivo .env. El servicio de Gemini no funcionará.");
}

let genAI;
let model;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
    console.log("[GeminiService] Modelo de Gemini inicializado correctamente.");
  } catch (error) {
    console.error("[GeminiService] Error al inicializar el SDK de GoogleGenerativeAI. Verifica tu API Key y la configuración.", error);
    // Considera lanzar el error si Gemini es crítico para el arranque de la aplicación.
    // throw error;
  }
}

/**
 * Analiza un historial de conversación para extraer información de un pedido.
 * @param {string} conversationHistory - El historial de la conversación formateado como un string.
 * @returns {Promise<string|null>} La respuesta de Gemini (idealmente JSON estructurado) o null si hay un error o el modelo no está inicializado.
 */
export async function analyzeConversationForOrder(conversationHistory) {
  if (!model) {
    console.error("[GeminiService] El modelo de Gemini no está inicializado. No se puede procesar la solicitud.");
    return null;
  }
  if (!conversationHistory || conversationHistory.trim() === "") {
    console.log("[GeminiService] El historial de conversación está vacío. No se llamará a Gemini.");
    return null;
  }

  try {
    const prompt = `
Analiza la siguiente conversación entre un Vendedor y un Cliente.
El objetivo es extraer la información necesaria para tomar un pedido.
Por favor, identifica y estructura los siguientes detalles del pedido en formato JSON.
Si alguna información no está presente, omite el campo o establécelo como null.
Asegúrate de que la salida sea únicamente el objeto JSON, sin texto adicional antes o después.

Campos a extraer:
- "cliente_nombre": (string, opcional) Nombre del cliente si se menciona.
- "productos": (array de objetos) Lista de productos solicitados. Cada objeto debe tener:
    - "nombre": (string) Nombre del producto.
    - "cantidad": (number o string) Cantidad del producto.
    - "especificaciones": (string, opcional) Detalles adicionales como color, tamaño, etc.
- "direccion_entrega": (string, opcional) Dirección completa para la entrega.
- "metodo_pago": (string, opcional) Método de pago preferido si se discute.
- "notas_adicionales": (string, opcional) Cualquier otra instrucción o detalle importante del pedido.

Conversación:
---
${conversationHistory}
---

Pedido en JSON:
`;
    // console.log("[GeminiService] Enviando prompt a Gemini:", prompt); // Descomentar para depuración detallada del prompt
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Intenta limpiar la respuesta para obtener solo el JSON
    // Gemini a veces envuelve la respuesta en ```json ... ```
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }
    // Si no hay un bloque de código JSON, devuelve el texto tal cual,
    // asumiendo que podría ser JSON directamente o que el procesamiento posterior lo manejará.
    return text.trim();

  } catch (error) {
    console.error("[GeminiService] Error al llamar a la API de Gemini para analizar el pedido:", error);
    return null;
  }
}
