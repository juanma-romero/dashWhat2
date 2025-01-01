import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io' 
import cors from 'cors'
import pkg from 'pg'
//import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb'

//dotenv.config()
const myWhatsAppNumber = '595985214420@s.whatsapp.net'
const { Pool } = pkg// usado para postgresql
const app = express();
const server = http.createServer(app)

//configura db
//Mongo
const uri = "mongodb://127.0.0.1:27017/dash"; // Replace with your connection string
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

let collection;  // Variable to hold the collection

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('dash'); // Access your database
    collection = db.collection('messages'); // Access your collection    
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase()

/*
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dash',
  password: process.env.PASS_DB,
  port: 5432,
})
*/
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
    const messages = await collection.find().sort({ timestamp: -1 }).toArray() // Convert to array
    res.json(messages)
  } catch (err) {
    console.error('Error fetching message history from MongoDB', err)
    res.status(500).send('Error fetching message history')
  }
})


/*app.get('/api/messages/history', async (req, res) => {
  try {
    // Realizar la consulta a la base de datos
    const result = await pool.query('SELECT * FROM messages ORDER BY timestamp DESC')
    //console.log('Message history fetched from DB:', result.rows);
    res.json(result.rows); // Enviar el resultado como JSON
  } catch (err) {
    console.error('Error fetching message history', err);
    res.status(500).send('Error fetching message history');
  }
})*/

// Ruta REST para recibir mensajes emitidos de Baileys y emitidos de Frontend para guardar en db 
app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message
  try {
    const result = await collection.insertOne(messageData); // Use collection.insertOne()
    console.log('Message stored in MongoDB:', result); // Log the result
    res.sendStatus(200)
  } catch (err) {
    console.error('Error storing message in MongoDB', err)
    res.status(500).send('Error storing message')
  }
})



//app.post('/api/messages', async (req, res) => {
//  console.log(req.body.message)
/*
  const id = message.key.id
            const sender = message.key.remoteJid
            const timestamp = message.messageTimestamp
            let textMessage = ""
// Manejo de diferentes tipos de mensaje
            if (message.message && message.message.conversation) {
                textMessage = message.message.conversation
            } else if (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text) {
                textMessage = message.message.extendedTextMessage.text
            }


  const messageData = req.body.messages[0]  // Asumimos que sólo hay un mensaje en el array
  const id = messageData.key.id
  const sender = messageData.key.remoteJid
  const text = messageData.message.conversation
  const timestamp = new Date(messageData.messageTimestamp * 1000) // Convertir de UNIX timestamp a JS Date
  const recipient = myWhatsAppNumber;
  const senderName = messageData.pushName; 

  try {
    // Guarda el mensaje en la base de datos
    await pool.query(
      'INSERT INTO messages (id, sender, senderName, text, timestamp, recipient) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, sender, senderName, text, timestamp, recipient]
    )    
    console.log('Mensaje almacenado en la DB:', { sender, senderName, text, timestamp, recipient })     
    res.sendStatus(200)
  } catch (err) {
    console.error('Error al almacenar el mensaje', err)
    res.status(500).send('Error storing message')
  }
  */
//})


//          Coneccion con websocket 
//  Envia desde 1) Front>>Baileys y desde 2) Baileys>>Front
io.on('connection', (socket) => {
  console.log('A user connected')

  // 1) Manejo de envío de mensajes desde el frontend >>>> Baileys
  socket.on('send-message-from-frontend', async ({ sender, recipient, text }) => {
    try {      
      // Enviar el mensaje a Baileys para ser reenviado a WhatsApp
      io.emit('send-message-from-frontend', { sender, remoteJid: recipient, message: text })

    } catch (err) {
      console.error('Error storing message', err)
    }
  }) 

  // 2) Manejo de mensajes desde Baileys >>> frontend
  socket.on('new-message-from-whatsapp', async (messageData) => {
    try {
      io.emit('new-message-from-whatsapp', { messageData })
    } catch (err) {
      console.error('Error processing message', err)
    }
  })

  socket.on('disconnect', () => {
    console.log('User disconnected')
  })
})

server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})




/*

*/