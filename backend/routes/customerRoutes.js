import express from 'express';
import { getCustomerData, getLastOrder, updateCustomerProfile } from '../controllers/customerController.js';

const router = express.Router();

// Ruta para obtener datos del cliente
router.get('/customer/:chatId', getCustomerData);

// Ruta para obtener el último pedido del cliente
router.get('/last-order/:chatId', getLastOrder);

// Ruta para actualizar datos del cliente
router.put('/customer-profile', updateCustomerProfile);

export default router;