import { connectToDatabase } from '../utils/db.js';

let collection;
let collectionContacto;
let collectionPedidos;

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chats');
    collectionContacto = db.collection('contactosGoogle');
    collectionPedidos = db.collection('Pedidos');
  } catch (err) {
    console.error('Error initializing database in chatController:', err);
  }
}
initializeDatabase();

// Función para obtener todos los chats
export const getAllChats = async (req, res) => {
  try {
    const allChats = await collection.find({}).toArray()
    const transformedChats = allChats.map(chat => {
      const messages = Object.values(chat).filter(val => typeof val === 'object' && val !== null && 'messageTimestamp' in val)

      if (messages.length === 0) {
        return { remoteJid: chat.remoteJid, message: null, messageTimestamp: null };
      }

      const latestMessage = messages.reduce((latest, current) => {
        return new Date(latest.messageTimestamp) > new Date(current.messageTimestamp) ? latest : current;
      })

      return {
        remoteJid: chat.remoteJid,
        message: latestMessage.message,
        messageTimestamp: latestMessage.messageTimestamp,
        stateConversation: chat.stateConversation 
      }
    })

    // Ordenar los chats transformados por la última marca de tiempo del mensaje
    transformedChats.sort((chatA, chatB) => {
      const timestampA = chatA.messageTimestamp ? new Date(chatA.messageTimestamp) : 0
      const timestampB = chatB.messageTimestamp ? new Date(chatB.messageTimestamp) : 0
      return timestampB - timestampA
    })

    // Obtener contactos relacionados con los chats
    const remoteJids = transformedChats.map(chat => chat.remoteJid)
    const contactosChat = await collectionContacto.find({ Phone: { $in: remoteJids } }).toArray()

    // Combinar chats y contactos
    const combinedChats = await Promise.all(transformedChats.map(async (chat) => {
      const contact = contactosChat.find(c => c.Phone === chat.remoteJid)

      return {
        ...chat, // Spread existing chat properties
        contact: contact ? {  // Add contact info conditionally
          firstName: contact.firstName,
          lastName: contact.lastName,
          // ... other contact fields
        } : null, // or null if no contact found
      }
    }))
    res.json(combinedChats);

  } catch (err) {
    console.error('Error fetching all chats:', err);
    res.status(500).send('Error fetching all chats');
  }
}

// Función para obtener los mensajes de un chat específico
export const getChatMessages = async (req, res) => {
  try {
    const remoteJid = req.params.remoteJid;
    const chat = await collection.findOne({ remoteJid: remoteJid });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Extraer mensajes y convertir a array
    const messages = Object.values(chat).filter(
      (val) => typeof val === 'object' && val !== null && 'messageTimestamp' in val
    );

    // Ordenar mensajes por marca de tiempo
    messages.sort((a, b) => new Date(a.messageTimestamp) - new Date(b.messageTimestamp));
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages for chat:', err);
    res.status(500).send('Error fetching messages for chat');
  }
}

//Función para actualizar el estado de la conversación
export const updateStateConversation = async (req, res) => {
  //console.log(req.body);
  try {
    const { remoteJid, stateConversation } = req.body;

    // Validar que los parámetros necesarios están presentes
    if (!remoteJid || !stateConversation) {
      return res.status(400).send('remoteJid y stateConversation son requeridos');
    }

    // Actualizar el estado de la conversación en la base de datos
    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      { $set: { stateConversation: stateConversation } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send('No se encontró el chat con el remoteJid especificado');
    }

    res.status(200).send('Estado de la conversación actualizado correctamente');
  } catch (err) {
    console.error('Error actualizando el estado de la conversación:', err);
    res.status(500).send('Error actualizando el estado de la conversación');
  }
}

// Función para actualizar el estado de la conversación al ser clickeado un nuevo mensaje entrante
export const updateStateConversationNewMessage = async (req, res) => {
  const { remoteJid, stateConversation } = req.body;

  try {
    const result = await collection.updateOne(
      { remoteJid: remoteJid },
      {
        $set: { stateConversation: stateConversation }
      }
    );

    if (result.modifiedCount > 0) {
      res.sendStatus(200);
    } else {
      res.status(404).send('Chat not found');
    }
  } catch (err) {
    console.error('Error updating chat state in MongoDB:', err);
    res.status(500).send('Error updating chat state');
  }
}
