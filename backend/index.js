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

const app = express()
const server = http.createServer(app)
app.use(express.json())

// Declara Socket.io y Configurar CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true 
  }
})
io.on("connection", (socket) => {
  console.log('New client connected:')
})

dotenv.config()

// Variable para la colección
let collection;

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chats');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}
initializeDatabase();

// Middleware para manejar CORS en Express 
app.use(cors({
  origin: 'http://localhost:5173',
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

  try {
    const remoteJid = messageData.key.remoteJid;
    const messageID = messageData.key.id;

    // Fetch the current chat state
    const chat = await collection.findOne({ remoteJid: remoteJid });
    let updatedStateConversation = 'No leido'; // Default state for new messages

    if (chat) {
      if (chat.stateConversation === 'Resuelto') {
        updatedStateConversation = 'No leido';
      } else {
        updatedStateConversation = chat.stateConversation;
      }
    }

    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $set: { 
          [messageID]: messageData,
          stateConversation: updatedStateConversation
        },
        $setOnInsert: { remoteJid: remoteJid }
      },
      { upsert: true }
    );
    const transformedMessage = { 
      ...messageData, 
      _id: result.upsertedId ? result.upsertedId._id : null,
      stateConversation: updatedStateConversation // Include the updated state
    };
    //console.log(transformedMessage);
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
    try {
      const response = await fetch('http://localhost:3000/send-message', {
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
        throw new Error(`HTTP error ${response.status}`);
      }

      // Handle success (e.g., update database, send confirmation to frontend)

    } catch (error) {
      console.error('Error sending message to Baileys:', error);
      // Handle error (e.g., send error message to frontend)
    }
  });
})

server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})
