import express from 'express' 
import http from 'http'
//import { Server } from 'socket.io' 
//import cors from 'cors'
import dotenv from 'dotenv'
import { connectToDatabase } from './utils/db.js';

// rutas
//import chatRoutes from './routes/chatRoutes.js'
//import customerRoutes from './routes/customerRoutes.js'
//import orderRoutes from './routes/orderRoutes.js'

// Importar el nuevo servicio de procesamiento de pedidos
import { processOrderFromConversation } from './services/order-processing-service.js';
const app = express()
const server = http.createServer(app)

// Increase the limit for JSON payloads
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true })); 

// Declara Socket.io y Configurar CORS
/*
const frontendOrigin = process.env.FRONTEND_URL || 'https://dash-what2.vercel.app';
const io = new Server(server, {
  cors: {
    origin: frontendOrigin, 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true 
  }
})
io.on("connection", (socket) => {
  console.log('New client connected:', socket.id)
})
*/
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
initializeDatabase();

// Middleware para manejar CORS en Express 
/*
app.use(cors({
  origin: frontendOrigin,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type']
}))
*/
// Usar las rutas de chats
//app.use('/api', chatRoutes) 

// Ruta para responder ultimo pedido y perfil del cliente
//app.use('/api', customerRoutes)

// Usar las rutas de pedidos
//app.use('/api', orderRoutes)


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
    // 6. Emitir el mensaje a través de Socket.IO al frontend
    // Creamos un objeto similar al anterior para no romper tu frontend
    /*const messageForFrontend = {
      _id: updatedConversation._id, // ID de la conversación, siempre disponible gracias a findOneAndUpdate
      chatRemoteJid: remoteJid,
      stateConversation: updatedConversation.stateConversation,
      // Pasamos el mensaje original que recibió la API para consistencia
      key: messageData.key,
      type: messageData.type,
      content: messageData.content,
      caption: messageData.caption,
      contactInfo: messageData.contactInfo,
      quotedMessage: messageData.quotedMessage,
      messageTimestamp: messageData.messageTimestamp,
      pushName: messageData.pushName
    };

    io.emit('new-message', messageForFrontend);
    res.sendStatus(200);*/

  } catch (err) {
    console.error('Error procesando el mensaje en MongoDB:', err);
    res.status(500).send('Error al procesar el mensaje');
  }
})


// Ruta REST recibe mensajes emitidos de Frontend, reenviados a Baileys
/*
io.on("connection", (socket) => {
  socket.on("send-message-from-frontend", async (msg) => {
    if (!msg || !msg.remoteJid || typeof msg.message !== 'string') {
        console.error("[IndexJS Socket] Mensaje inválido desde el frontend:", msg);
        // Opcional: emitir un error de vuelta al cliente
        // socket.emit('send-message-error', { message: 'Datos del mensaje inválidos', originalMsg: msg });
        return;
    }
    try {
      const baileysApiUrl = process.env.API_BAILEYS_URL || 'http://localhost:8080/send-message';
      const response = await fetch(baileysApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remoteJid: msg.remoteJid,  
          message: msg.message
        }), 
      })

      if (!response.ok) {
        let errorBody = '';
        try {
            errorBody = await response.text();
        } catch (e) {
            // Ignorar si no se puede leer el cuerpo del error
        }
        throw new Error(`HTTP error ${response.status} al enviar a Baileys: ${errorBody}`);
      }
      // Opcional: Confirmar al frontend que el mensaje fue enviado a Baileys
      // socket.emit('message-sent-to-baileys-ack', { success: true, originalMsg: msg });
    } catch (error) {
      console.error('[IndexJS Socket] Error sending message to Baileys:', error);
      // Opcional: Emitir un error de vuelta al cliente
      // socket.emit('send-message-error', { message: error.message, originalMsg: msg });
    }
  });
})
*/
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})
