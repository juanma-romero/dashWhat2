import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv'

dotenv.config()

// Conexión a la base de datos
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let collectionPedidos;
let collectionProductos;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB orderController.js');
    const db = client.db('dash');
    collectionPedidos = db.collection('Pedidos');
    collectionProductos = db.collection('productos');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connectToDatabase();

// Función para crear un nuevo pedido
export const createNewOrder = async (req, res) => {
  try {
    const newOrder = req.body;

    // Insertar el nuevo pedido en la colección
    const result = await collectionPedidos.insertOne(newOrder);

    res.status(201).json({ message: 'Order created successfully', orderId: result.insertedId });
  } catch (error) {
    console.error('Error creating new order:', error);
    res.status(500).json({ message: 'Error creating new order' });
  }
};

// Función para obtener todos los productos
export const getAllProducts = async (req, res) => {
  try {
    const products = await collectionProductos.find({}).toArray(); // Fetch all products
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
}

// Función para actualizar un pedido
export const updateOrder = async (req, res) => {
  try {
    const updatedOrder = req.body;
    
    const orderId = ObjectId.createFromHexString(updatedOrder.idOrder)    
    
    
    // Actualizar el pedido en la colección
    const modificado = await collectionPedidos.updateOne(
      { _id: orderId },
      { $set: {
        fechaEntrega: updatedOrder.fechaEntrega,
        items: updatedOrder.items,
        status: updatedOrder.status
      } }
    )
    console.log('modificado:', modificado);
    res.json({ message: 'Order updated successfully' })
  }
  catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Error updating order' })  
    }    
}