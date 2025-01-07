

import express from 'express' 
import http from 'http'
import { Server } from 'socket.io' 
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient} from 'mongodb'
dotenv.config()
const uri = process.env.MONGODB_URI
 
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

// Middleware para manejar CORS en Express 
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))

//configura Mongodb

const client = new MongoClient(uri)

let collection
let collectionContacto
let collectionPedidos
let collectionProductos


async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB')
    const db = client.db('dash') 
    collection = db.collection('chats') 
    collectionContacto = db.collection('contactosGoogle')
    collectionPedidos = db.collection('Pedidos')
    collectionProductos = db.collection('productos')
    
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase()

// Ruta para obtener el historial de mensajes

app.get('/api/all-chats', async (req, res) => {
  try {    
    const allChats = await collection.find({}).toArray()
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

  // Fetch contacts related to the chats
  const remoteJids = transformedChats.map(chat => chat.remoteJid);
  const contactosChat = await collectionContacto.find({ Phone: { $in: remoteJids } }).toArray()
  
  // Combine chats and contacts
  const combinedChats = transformedChats.map(chat => {
    const contact = contactosChat.find(c => c.Phone === chat.remoteJid);
    return {
      ...chat, // Spread existing chat properties
      contact: contact ? {  // Add contact info conditionally
        firstName: contact['First Name'],
        lastName: contact['Last Name'],
        // ... other contact fields
      } : null // or null if no contact found
    };
  });

  res.json(combinedChats)
    
  } catch (err) {
    console.error('Error fetching all chats:', err)
    res.status(500).send('Error fetching all chats')
  }
})


//ruta para obtener el historial de un chat especifico
app.get('/api/messages/:remoteJid', async (req, res) => {
  try {
    const remoteJid = req.params.remoteJid;
    const chat = await collection.findOne({ remoteJid: remoteJid });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Extract messages and convert to array
    const messages = Object.values(chat).filter(
      (val) => typeof val === 'object' && val !== null && 'messageTimestamp' in val
    )
        // Sort messages by timestamp
        messages.sort((a, b) => new Date(a.messageTimestamp) - new Date(b.messageTimestamp))
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages for chat:', err);
    res.status(500).send('Error fetching messages for chat');
  }
})

// Ruta REST para recibir mensajes emitidos de Baileys, reenviados a Frontend y para guardar en db 
app.post('/api/messages', async (req, res) => {
  const messageData = req.body.message
  
  try {
    const remoteJid = messageData.key.remoteJid
    const messageID = messageData.key.id
     // Convert messageTimestamp to ISO date string if it's a number (unix epoch timestamp)
    
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

// Ruta REST recibe mensajes emitidos de Frontend, reenviados a Baileys
// Example using fetch or axios in your Cloud Run backend
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

// responde datos cliente
app.get('/api/customer/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId; // Get the chatId from the URL parameter

    // Query the "contactosGoogle" collection
    const customer = await collectionContacto.findOne({ Phone: chatId });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

     // Transform customer data. Select the fields you need
    const transformedCustomer = {
        name: `${customer['First Name']} ${customer['Last Name']}`,
        phone: customer.Phone,
        // ... other fields you want to send to the frontend
    }
    
    res.json(transformedCustomer);
  } catch (error) {
    console.error('Error fetching customer data:', error);
    res.status(500).json({ message: 'Error fetching customer data' });
  }
})

// responde ultimo pedido guardado
app.get('/api/last-order/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId;

    const lastOrder = await collectionPedidos.find({ 
        Phone: chatId 
    })
    .sort({ fechaSolicitud: -1 }) // Sort in descending order to get the latest
    .limit(1)
    .toArray()

    if (!lastOrder || lastOrder.length ===0) {  // Check for empty array
      return res.status(404).json({ message: 'No previous orders found for this customer' });
    }
    console.log(lastOrder[0])
    res.json(lastOrder[0]);
  } catch (error) {
    console.error('Error fetching last order:', error);
    res.status(500).json({ message: 'Error fetching last order' });
  }
})

// respone a llamado de todos los productos y precio unit
app.get('/api/products', async (req, res) => {
  try {
    const products = await collectionProductos.find({}).toArray(); // Fetch all products
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
})

// Ruta para recibir el nuevo pedido
app.post('/api/customer/newOrder', async (req, res) => {
  try {
    const newOrder = req.body;

    // Insertar el nuevo pedido en la colección
    const result = await collectionPedidos.insertOne(newOrder);

    res.status(201).json({ message: 'Order created successfully', orderId: result.insertedId });
  } catch (error) {
    console.error('Error creating new order:', error);
    res.status(500).json({ message: 'Error creating new order' });
  }
})


server.listen(5000, () => {
  console.log('Server is listening on port 5000')
})


