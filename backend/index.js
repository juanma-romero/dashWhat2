import express from 'express'
import http from 'http'
import { Server } from 'socket.io' 
import cors from 'cors'
import { MongoClient} from 'mongodb'

const app = express()
const server = http.createServer(app)
app.use(express.json())

// Configurar CORS para socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true 
  }
})

// Middleware para manejar CORS en Express 
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))

//configura Mongodb
const uri = "mongodb+srv://xjuanmaromerox:l5beLvmJ2Kgfyab5@cluster0.ubphg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const client = new MongoClient(uri)

let collection

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB')
    const db = client.db('dash') 
    collection = db.collection('chats') 

  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase()

// Ruta para obtener el historial de mensajes a enviar a Frontend
app.get('/api/all-chats', async (req, res) => {
  try {
    
    const allChats = await collection.find({}).toArray();

    const transformedChats = allChats.map(chat => {
      const messages = Object.values(chat).filter(val => typeof val === 'object' && val !== null && 'messageTimestamp' in val)
      
      if (messages.length === 0) {
        return { remoteJid: chat.remoteJid, message: null, messageTimestamp: null }
      }

      const latestMessage = messages.reduce((latest, current) => {
        return new Date(latest.messageTimestamp) > new Date(current.messageTimestamp) ? latest : current;
      })

      return {
        remoteJid: chat.remoteJid,
        message: latestMessage.message,
        messageTimestamp: latestMessage.messageTimestamp,
      }
    })
    
    // Sort the transformedChats based on the latest message timestamp
    transformedChats.sort((chatA, chatB) => {
      const timestampA = chatA.messageTimestamp ? new Date(chatA.messageTimestamp) : 0;
      const timestampB = chatB.messageTimestamp ? new Date(chatB.messageTimestamp) : 0;
      return timestampB - timestampA;
  })

    res.json(transformedChats)
  } catch (err) {
    console.error('Error fetching all chats:', err)
    res.status(500).send('Error fetching all chats')
  }
})

// Ruta REST para recibir mensajes emitidos de Baileys y emitidos de Frontend para guardar en db 
app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message
  
  try {
    const { remoteJid} = messageData.remoteJid;
    const messageID = messageData.key.id
     // Convert messageTimestamp to ISO date string if it's a number (unix epoch timestamp)
    if (typeof messageData.messageTimestamp === 'number') {
        messageData.messageTimestamp = new Date(messageData.messageTimestamp * 1000).toISOString(); 
    } 

    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $set: { [messageID]: messageData },
        $setOnInsert: { remoteJid: remoteJid} 
      },
      { upsert: true }
    )
    const transformedMessage = { ...messageData, _id: result.upsertedId ? result.upsertedId._id : null };
    
    console.log(transformedMessage)
    io.emit('new-message', transformedMessage)
    res.sendStatus(200)
    }
    catch (err) {
    console.error('Error storing message in MongoDB', err)
    res.status(500).send('Error storing message')
  }
})

server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})

