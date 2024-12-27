import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import pkg from 'pg'

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

// Ruta para obtener el historial de mensajes
app.get('/api/messages/history', async (req, res) => {
  try {
    // Realizar la consulta a la base de datos
    const result = await pool.query('SELECT * FROM messages ORDER BY timestamp DESC')
    //console.log('Message history fetched from DB:', result.rows);
    res.json(result.rows); // Enviar el resultado como JSON
  } catch (err) {
    console.error('Error fetching message history', err);
    res.status(500).send('Error fetching message history');
  }
})

// Ruta REST para recibir mensajes de Baileys
app.post('/api/messages', async (req, res) => {
  const { sender, text, timestamp } = req.body
  const recipient = '595985214420@s.whatsapp.net'  // Estableciendo el recipient directamente

  try {
    // Guarda el mensaje en la base de datos
    await pool.query(
      'INSERT INTO messages (sender, text, timestamp, recipient) VALUES ($1, $2, $3, $4)',
      [sender, text, new Date(timestamp), recipient]
    )
    
    console.log('Mensaje almacenado en la DB:', { sender, text, timestamp, recipient })
    io.emit('new-message', { sender, text, timestamp, recipient })
    res.sendStatus(200)   

  } catch (err) {
    console.error('Error al almacenar el mensaje', err)
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
        'INSERT INTO messages (sender, text, timestamp, recipient) VALUES ($1, $2, $3, $4)',
        [sender, text, timestamp, recipient]
      )
      console.log('Message stored in DB:', { sender, recipient, text, timestamp });

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