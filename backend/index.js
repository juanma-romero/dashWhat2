import express from 'express' 
import http from 'http'
import dotenv from 'dotenv'
import { connectToDatabase } from './utils/db.js';

// Importar el nuevo servicio de procesamiento de pedidos
import { processOrderFromConversation } from './services/order-processing-service.js';
const app = express()
const server = http.createServer(app)

// Increase the limit for JSON payloads
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true })); 


dotenv.config()

// Variable para la colección
let collection

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chatsV2');
    console.log("Conexión a la base de datos y colección 'chatsV2' inicializada.");
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1); // Salir si la BD no se puede inicializar
  }
}
initializeDatabase()

app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message

  if (!messageData || !messageData.key || !messageData.key.remoteJid || !messageData.key.id) {
    console.error("Datos del mensaje incompletos o inválidos recibidos:", messageData);
    return res.status(400).send('Datos del mensaje incompletos o inválidos.');
  }

  // Si el mensaje es la clave, el procesamiento del pedido con Gemini se inicia en segundo plano
  // Esta lógica no necesita cambiar.
  if (messageData.content && messageData.content.toLowerCase() === 'te tomo el pedido') {
    console.log(`[IndexJS] Mensaje clave 'te tomo el pedido' detectado para ${messageData.key.remoteJid}.`);
    processOrderFromConversation(messageData.key.remoteJid, collection)
      .catch(err => {
        console.error("[IndexJS] Error en el procesamiento de pedido en segundo plano:", err);
      });
  }

  try {
    const remoteJid = messageData.key.remoteJid;

    // 1. Formatear el mensaje para que coincida con nuestro nuevo esquema de array
    const formattedMessage = {
      id: messageData.key.id,
      role: messageData.key.fromMe ? 'assistant' : 'user',
      type: messageData.type,
      content: messageData.content || null, // Asegurar que sea null si no existe
      caption: messageData.caption || null,
      mediaUrl: messageData.mediaUrl || null, // Si ya tienes lógica para subir media
      contactInfo: messageData.contactInfo || null,
      quotedMessage: messageData.quotedMessage || null,
      timestamp: messageData.messageTimestamp 
               ? new Date(messageData.messageTimestamp) 
               : new Date()
  }

    // 2. Determinar el nuevo estado de la conversación
    // Usamos findOne para chequear el estado actual antes de la actualización.
    const currentChat = await collection.findOne({ contactJid: remoteJid });
    let updatedStateConversation = 'No leido';
    if (currentChat && currentChat.stateConversation === 'Resuelto') {
      updatedStateConversation = 'No leido';
    } else if (currentChat) {
      updatedStateConversation = currentChat.stateConversation;
    }
    
    // 3. Construir el objeto de actualización de forma dinámica
  const updateOperation = {
    $push: { messages: formattedMessage },
    $set: {
      stateConversation: updatedStateConversation,
      updatedAt: new Date()
    },
    $setOnInsert: {
      contactJid: remoteJid,
      createdAt: new Date()
    }
  };

  // 4. AÑADIR CONDICIONALMENTE la actualización del contactName
  // Solo si el mensaje es del usuario (`fromMe` es `false`)
  if (!messageData.key.fromMe) {
    updateOperation.$set.contactName = messageData.pushName;
  }

  // 5. Ejecutar la operación de findOneAndUpdate con el objeto dinámico
    const updatedConversation = await collection.findOneAndUpdate(
    { contactJid: remoteJid },
    updateOperation, // Usamos nuestro objeto construido dinámicamente
    { 
      upsert: true,
      returnDocument: 'after'
    }
  )
   

  } catch (err) {
    console.error('Error procesando el mensaje en MongoDB:', err);
    res.status(500).send('Error al procesar el mensaje');
  }
})

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})
