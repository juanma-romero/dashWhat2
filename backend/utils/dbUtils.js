import { MongoClient } from 'mongodb';
import fs from 'fs';

const uri = "mongodb+srv://xjuanmaromerox:l5beLvmJ2Kgfyab5@cluster0.ubphg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('dash');
    const collection = db.collection('chats');

    // Realizar una consulta para todos los documentos
    const cursor = collection.find({});
    const results = [];

    await cursor.forEach(doc => {
      const fields = Object.keys(doc);
      const filteredFields = fields.filter(field => !['stateConversation', '_id', 'remoteJid'].includes(field));
      
      const pushNames = filteredFields.map(field => doc[field]?.pushName).filter(pushName => pushName !== undefined && pushName !== 'Voraz');
      const uniquePushNames = [...new Set(pushNames)];
      
      if (uniquePushNames.length > 0) {
        results.push({ remoteJid: doc.remoteJid, pushName: uniquePushNames[0] });
      }
    });

    // Guardar los resultados en un archivo .json
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to results.json');

  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

connectToDatabase();