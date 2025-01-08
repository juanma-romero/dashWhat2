import express from 'express';
import { getAllChats, getChatMessages } from '../controllers/chatController.js';

const router = express.Router();

// Ruta para obtener todos los chats
router.get('/all-chats', getAllChats);

// Ruta para obtener los mensajes de un chat específico
router.get('/messages/:remoteJid', getChatMessages);

export default router;