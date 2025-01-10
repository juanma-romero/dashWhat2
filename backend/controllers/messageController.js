/*
import dotenv from 'dotenv'
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';
import http from 'http'
import express from 'express'
const app = express()
const server = http.createServer(app)

dotenv.config()

// Conexión a la base de datos
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let collection;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB messageController.js');
    const db = client.db('dash');
    collection = db.collection('chats');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase()

// Declara Socket.io y Configurar CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true 
  }
}) 



// Función para almacenar mensajes
export const storeMessage = async (req, res) => {
  const messageData = req.body.message;

  try {
    const remoteJid = messageData.key.remoteJid;
    const messageID = messageData.key.id;

    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $set: { [messageID]: messageData },
        $setOnInsert: { remoteJid: remoteJid }
      },
      { upsert: true }
    );
    const transformedMessage = { ...messageData, _id: result.upsertedId ? result.upsertedId._id : null };

    console.log(transformedMessage);
    io.emit('new-message', transformedMessage);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error storing message in MongoDB:', err);
    res.status(500).send('Error storing message');
  }
}

server.listen(5000, () => {
  console.log('Server is listening on port 5000:2')
})
  */