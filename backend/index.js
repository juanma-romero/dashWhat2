import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import pkg from 'pg'
const { Pool } = pkg;


const app = express();
const server = http.createServer(app);

//configura db
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'dash',
  password: 'Feo18aY17?',
  port: 5432,
});



// Configurar CORS para socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Reemplaza con el origen correcto
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true // Permite compartir cookies 
  }
});

// Middleware para manejar CORS en Express (para cualquier otra ruta)
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

io.on('connection', (socket) => {
  console.log('A user connected');
  
   // Escucha mensajes desde el cliente
   socket.on('send-message', async (data) => {
    const { sender, text, timestamp } = data;
    // Almacena el mensaje en la base de datos
    try {
      await pool.query(
        'INSERT INTO messages (sender, text, timestamp) VALUES ($1, $2, $3)',
        [sender, text, new Date(timestamp)]
      );
      console.log('Message stored in DB:', data)
      // Emitir el mensaje a todos los clientes conectados
      io.emit('new-message', { sender, text, timestamp });
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