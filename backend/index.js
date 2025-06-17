import express from 'express' 
import http from 'http'
import { Server } from 'socket.io' 
import cors from 'cors'
import dotenv from 'dotenv'
import { connectToDatabase } from './utils/db.js';

// rutas
import chatRoutes from './routes/chatRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
//import messageRoutes from './routes/messageRoutes.js'
import orderRoutes from './routes/orderRoutes.js'

// Importar el nuevo servicio de procesamiento de pedidos
import { processOrderFromConversation } from './services/order-processing-service.js';
const app = express()
const server = http.createServer(app)

// Increase the limit for JSON payloads
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true })); 

// Declara Socket.io y Configurar CORS
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
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

dotenv.config()

// Variable para la colección
let collection

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chats');
    console.log("Conexión a la base de datos y colección 'chats' inicializada.");
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1); // Salir si la BD no se puede inicializar
  }
}
initializeDatabase();

// Middleware para manejar CORS en Express 
app.use(cors({
  origin: frontendOrigin,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type']
}))

// Usar las rutas de chats
app.use('/api', chatRoutes) 

// Ruta para responder ultimo pedido y perfil del cliente
app.use('/api', customerRoutes)

// Usar las rutas de mensajes
//app.use('/api', messageRoutes)

// Usar las rutas de pedidos
app.use('/api', orderRoutes)

app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message;

  if (!messageData || !messageData.key || !messageData.key.remoteJid || !messageData.key.id) {
    console.error("Datos del mensaje incompletos o inválidos recibidos en /api/messages:", messageData);
    return res.status(400).send('Datos del mensaje incompletos o inválidos.');
  }

  // Verificar si el mensaje es la clave para activar el procesamiento del pedido
  // y si messageData.content existe
  if (messageData.content && messageData.content.toLowerCase() === 'te tomo el pedido') {
    console.log(`[IndexJS] Mensaje clave 'te tomo el pedido' detectado para ${messageData.key.remoteJid}.`);
    // Llamar al servicio de procesamiento de pedidos.
    // Pasamos la 'collection' para que el servicio pueda acceder a la BD.
    // No usamos 'await' aquí para que la respuesta al cliente (res.sendStatus(200)) sea rápida.
    // El procesamiento del pedido con Gemini puede ocurrir en segundo plano.
    processOrderFromConversation(messageData.key.remoteJid, collection)
      .catch(err => {
        // Es buena idea tener un manejo de errores aquí para el proceso en segundo plano
        console.error("[IndexJS] Error en el procesamiento de pedido en segundo plano:", err);
      });
  }

  try {
    const remoteJid = messageData.key.remoteJid;
    const messageID = messageData.key.id;

    // Fetch the current chat state (messageData is now our structured object from api/main.js)
    const chat = await collection.findOne({ remoteJid: remoteJid });
    let updatedStateConversation = 'No leido'; // Default state for new messages

    if (chat) {
      updatedStateConversation = chat.stateConversation === 'Resuelto' ? 'No leido' : chat.stateConversation;
    }
    
    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $set: { 
          [messageID]: messageData, // Store the full structured messageData
          stateConversation: updatedStateConversation
        },
        $setOnInsert: { remoteJid: remoteJid }
      },
      { upsert: true }
    )
    
    const transformedMessage = {
      _id: result.upsertedId ? result.upsertedId._id : (chat && chat._id ? chat._id.toString() : null), // Asegurar que _id del chat se propague si existe
      chatRemoteJid: remoteJid, // Añadir remoteJid al objeto emitido para el frontend
      stateConversation: updatedStateConversation, // Include the updated state
      key: messageData.key,
      type: messageData.type,
      content: messageData.content,
      caption: messageData.caption, // Will be undefined for text messages, which is fine
      contactInfo: messageData.contactInfo, // For contact messages
      quotedMessage: messageData.quotedMessage, // For replies
      messageTimestamp: messageData.messageTimestamp,
      pushName: messageData.pushName
    };

    io.emit('new-message', transformedMessage);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error storing message in MongoDB:', err);
    res.status(500).send('Error storing message');
  }
})


// Ruta REST recibe mensajes emitidos de Frontend, reenviados a Baileys
io.on("connection", (socket) => {
  socket.on("send-message-from-frontend", async (msg) => {
    if (!msg || !msg.remoteJid || typeof msg.message !== 'string') {
        console.error("[IndexJS Socket] Mensaje inválido desde el frontend:", msg);
        // Opcional: emitir un error de vuelta al cliente
        // socket.emit('send-message-error', { message: 'Datos del mensaje inválidos', originalMsg: msg });
        return;
    }
    try {
      const baileysApiUrl = process.env.API_BAILEYS_URL || 'http://localhost:3000/send-message';
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

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})
