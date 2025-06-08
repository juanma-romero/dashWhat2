import { connectToDatabase } from '../utils/db.js';

let collectionContacto;
let collectionPedidos;

// Inicializar conexión a la base de datos
async function initializeDatabase() {
  try {
    const { db } = await connectToDatabase();
    collectionContacto = db.collection('contactosGoogle');
    collectionPedidos = db.collection('Pedidos');
  } catch (err) {
    console.error('Error initializing database in customerController:', err);
  }
}
initializeDatabase();
 
 // Función para obtener datos del cliente
 export const getCustomerData = async (req, res) => {
   try {
     const chatId = req.params.chatId; // Get the chatId from the URL parameter
 
     // Query the "contactosGoogle" collection
     const customer = await collectionContacto.findOne({ Phone: chatId });
 
     if (!customer) {
       return res.status(404).json({ message: 'Customer not found' });
     }
 
     // Transform customer data. Select the fields you need
     const transformedCustomer = {
       name: `${customer['firstName']} ${customer['lastName']}`,
       phone: customer.Phone,
       RUC: customer.RUC,
       whatName: customer.whatName,
       // ... other fields you want to send to the frontend
     }
 
     res.json(transformedCustomer);
   } catch (error) {
     console.error('Error fetching customer data:', error);
     res.status(500).json({ message: 'Error fetching customer data' });
   }
 };
 
 // Función para obtener el último pedido del cliente
 export const getLastOrder = async (req, res) => {
   try {
     const chatId = req.params.chatId;
 
     const lastOrder = await collectionPedidos.find({
       Phone: chatId
     })
       .sort({ fechaSolicitud: -1 }) // Sort in descending order to get the latest
       .limit(1)
       .toArray();
 
     if (!lastOrder || lastOrder.length === 0) {  // Check for empty array
       return res.status(404).json({ message: 'No previous orders found for this customer' });
     }
     //console.log(lastOrder[0]);
     res.json(lastOrder[0]);
   } catch (error) {
     console.error('Error fetching last order:', error);
     res.status(500).json({ message: 'Error fetching last order' });
   }
 };

 // Función para actualizar datos del cliente
  export const updateCustomerProfile = async (req, res) => {
    try {
      const { name, phone, RUC } = req.body;
  
      // Separar el nombre completo en First Name y Last Name
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ');
  
      // Actualizar el perfil del cliente en la base de datos
      const updatedCustomer = await collectionContacto.updateOne(
        {Phone: phone},
        {    
          $set: {      
            firstName,
            lastName,
            Phone: phone,
            RUC  
          }        
        },
        { upsert: true } // Insert a new document if no match is found
      )
  
      if (!updatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
  
      res.status(200).json(updatedCustomer);
    } catch (error) {
      console.error('Error updating customer profile:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
