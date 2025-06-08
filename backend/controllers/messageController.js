import { connectToDatabase } from '../utils/db.js';

let collection;

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collection = db.collection('chats');
  } catch (err) {
    console.error('Error initializing database in messageController:', err);
  }
}
initializeDatabase();

// Función para almacenar mensajes
export const storeMessage = async (req, res, io) => {
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

    //console.log(transformedMessage);
    io.emit('new-message', transformedMessage);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error storing message in MongoDB:', err);
    res.status(500).send('Error storing message');
  }
}
