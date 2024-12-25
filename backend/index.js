import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

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
  
  socket.on('ping', (data) => {
    console.log('Received from client:', data);
    socket.emit('pong', 'Hello from server!');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(5000, () => {
  console.log('Server is listening on port 5000');
});