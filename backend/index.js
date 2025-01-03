import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io' 
import cors from 'cors'
import { MongoClient, ServerApiVersion } from 'mongodb'

const app = express();
const server = http.createServer(app)

//configura Mongodb
const uri = "mongodb://127.0.0.1:27017/dash"; // Replace with your connection string
const client = new MongoClient(uri);

let collection;  // Variable to hold the collection

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('dash'); // Access your database
    collection = db.collection('chats'); // Access your collection    
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase()

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
app.use(express.json())

// Ruta para obtener el historial de mensajes a enviar a Frontend
app.get('/api/messages/history', async (req, res) => {
  try {
    const messages = await collection.aggregate([
      {
        $sort: { 'messageTimestamp': -1 } // Sort by messageTimestamp descending (newest first)
      },
      {
        $group: {
          _id: '$key.remoteJid', // Group by remoteJid
          messages: { $push: '$$ROOT' } // Push the entire message object into the messages array for each group
        }
      },      
      {
        $project: {
          _id: 0, // Exclude the _id field
          remoteJid: '$_id', // Rename _id to remoteJid          
          messages: { $slice: ['$messages', 1] } // Get only the first (most recent due to previous sort) message for each remoteJid
        }
      },
      {
        $sort: { 'messages.messageTimestamp': -1} // Sort the grouped conversations by timestamp of the first message within each group (descending)
      }
    ]).toArray();

    const formattedMessages = messages.map(group => group.messages[0]); // Map to extract only the messages from each group

    res.json(formattedMessages)
    //console.log(formattedMessages)
  } catch (err) {
    console.error('Error fetching message history from MongoDB', err);
    res.status(500).send('Error fetching message history');
  }
})

// Ruta para obtener el historial de mensajes de un chat en particular para  enviar a Frontend
app.get('/api/messages/conversation/:remoteJid', async (req, res) => {
  try {
    const remoteJid = req.params.remoteJid;
    const conversation = await collection.find({ 'key.remoteJid': remoteJid }).sort({ messageTimestamp: 1 }).toArray(); // Sort by messageTimestamp ascending for chat history display
    res.json(conversation);
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).send('Error fetching conversation');
  }
})


// Ruta REST para recibir mensajes emitidos de Baileys y emitidos de Frontend para guardar en db 
app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message;  // Access single message directly

  try {
    const { remoteJid, pushName} = messageData.key;

     // Convert messageTimestamp to ISO date string if it's a number (unix epoch timestamp)
    if (typeof messageData.messageTimestamp === 'number') {
        messageData.messageTimestamp = new Date(messageData.messageTimestamp * 1000).toISOString(); 
    } 

    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $push: { messages: messageData }, // Push the single message directly. No $each needed
        $setOnInsert: { remoteJid: remoteJid, pushName: pushName} 
      },
      { upsert: true }
    );

    const transformedMessage = { ...messageData, _id: result.upsertedId ? result.upsertedId._id : null };
    io.emit('message-from-baileys', { [remoteJid]: transformedMessage })
    console.log(transformedMessage)

    res.sendStatus(200)
  /*try {
    const result = await collection.insertOne(messageData); // Use collection.insertOne()
    //console.log('Message stored in MongoDB:', result); // Log the result
    // convirtiendo messagaData al formato de objeto necesitado en el ingreso de nuevo mensaje
    const transformedMessage = {
      _id: result.insertedId, // Use the MongoDB generated ID
      key: messageData.key,
      message: messageData.message, // This should already be just the text
      messageTimestamp: messageData.messageTimestamp,
      pushName: messageData.pushName,
      status: messageData.status || 4 // Or handle status appropriately
      // ...any other properties from messageData you need in the frontend
    }

    // emitiendo a front desde baileys
    io.emit('message-from-baileys', {[messageData.key.remoteJid]: transformedMessage})
    console.log(transformedMessage)
    res.sendStatus(200)
    */

  } catch (err) {
    console.error('Error storing message in MongoDB', err)
    res.status(500).send('Error storing message')
  }
})

server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})

