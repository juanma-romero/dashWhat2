import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import pkg from 'pg'
import axios from 'axios'

const { Pool } = pkg
const app = express();
const server = http.createServer(app)

//configura db
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dash',
  password: process.env.PASS_DB,
  port: 5432,
})

// Configurar CORS para socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true 
  }
})

// Middleware para manejar CORS en Express (para cualquier otra ruta)
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))
app.use(express.json());

// Ruta REST para recibir mensajes de Baileys
app.post('/api/messages', async (req, res) => {
  const { sender, text, timestamp } = req.body;
  
  try {
    // Guarda el mensaje en la base de datos
    await pool.query(
      'INSERT INTO messages (sender, text, timestamp) VALUES ($1, $2, $3)',
      [sender, text, new Date(timestamp)]
    )
    
    console.log('Message stored in DB:', { sender, text, timestamp })
    io.emit('new-message', { sender, text, timestamp })
    res.sendStatus(200)   

  } catch (err) {
    console.error('Error storing message', err)
    res.status(500).send('Error storing message')
  }
})

// coneccion con websocket
io.on('connection', (socket) => {
  console.log('A user connected')

  // Manejo de envío de mensajes desde el frontend
  socket.on('send-message', async ({ sender, recipient, text }) => {
    try {
      const timestamp = new Date().toISOString()

      // Guardar el mensaje en la base de datos
      await pool.query(
        'INSERT INTO messages (sender, text, timestamp) VALUES ($1, $2, $3)',
        [sender, text, timestamp]
      )
      console.log('Message stored in DB:', { sender, recipient, text });

      // Enviar el mensaje a Baileys para ser reenviado a WhatsApp
      io.emit('send-whatsapp-message', { remoteJid: recipient, message: text })

    } catch (err) {
      console.error('Error storing message', err)
    }
  }) 

  socket.on('disconnect', () => {
    console.log('User disconnected')
  })
})

server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})