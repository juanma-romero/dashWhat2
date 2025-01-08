import express from 'express';
import { createNewOrder, getAllProducts } from '../controllers/orderController.js';

const router = express.Router();

// Ruta para crear un nuevo pedido
router.post('/customer/newOrder', createNewOrder);

// Ruta para obtener todos los productos
router.get('/products', getAllProducts);

export default router;