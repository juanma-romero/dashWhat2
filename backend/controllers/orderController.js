import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../utils/db.js';

let collectionPedidos;
let collectionProductos;
let collectionUsuarios;

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collectionPedidos = db.collection('Pedidos');
    collectionProductos = db.collection('productos');
    collectionUsuarios = db.collection('contactosGoogle');
  } catch (err) {
    console.error('Error initializing database in orderController:', err);
  }
}
initializeDatabase();

// rutas para pedidos y para productos

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
    //console.log('modificado:', modificado);
    res.json({ message: 'Order updated successfully' })
  }
  catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Error updating order' })  
    }    
}

// Función para obtener todos los pedidos 
export const getAllOrders = async (req, res) => {
  try {
    const orders = await collectionPedidos.find({}).toArray() // Fetch all orders
    // Extract all unique Phone values from orders
    const phoneNumbers = orders.map(order => order.Phone);

    // Fetch contact information for these phone numbers
    const contacts = await collectionUsuarios.find({
      Phone: { $in: phoneNumbers }
    }).toArray();

    // Create a map of phone numbers to contact names
    const phoneToContactName = contacts.reduce((acc, contact) => {
      acc[contact.Phone] = contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : 'Nombre no encontrado';
      return acc;
    }, {});
    //console.log('phoneToContactName:', phoneToContactName);
    // Add contact names to orders
    const ordersWithContactNames = orders.map(order => ({
      ...order,
      contactName: phoneToContactName[order.Phone] || 'Nombre no encontrado'
    }));

    //console.log('ordersWithContactNames:', ordersWithContactNames);
    res.json(ordersWithContactNames)
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' })
  }
}
