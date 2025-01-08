import express from 'express';
import { getCustomerData, getLastOrder } from '../controllers/customerController.js';

const router = express.Router();

// Ruta para obtener datos del cliente
router.get('/customer/:chatId', getCustomerData);

// Ruta para obtener el último pedido del cliente
router.get('/last-order/:chatId', getLastOrder);

export default router;