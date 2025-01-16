import express from 'express';
import { createNewOrder, getAllProducts, updateOrder, getAllOrders } from '../controllers/orderController.js';

const router = express.Router()

// Ruta para obtener todos los productos
router.get('/products', getAllProducts)

// Ruta para crear un nuevo pedido
router.post('/customer/newOrder', createNewOrder)

// Ruta para actualizar un pedido
router.post('/orders/update', updateOrder)

// Ruta para obtener todos los pedidos
router.get('/orders', getAllOrders)

export default router;