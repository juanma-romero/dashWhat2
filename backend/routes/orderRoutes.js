import express from 'express';
import { createNewOrder, getAllProducts, updateOrder } from '../controllers/orderController.js';

const router = express.Router();

// Ruta para crear un nuevo pedido
router.post('/customer/newOrder', createNewOrder);

// Ruta para obtener todos los productos
router.get('/products', getAllProducts);

// Ruta para actualizar un pedido
router.post('/orders/update', updateOrder);

export default router;