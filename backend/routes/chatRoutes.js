import express from 'express';
import { getAllChats, getChatMessages, updateStateConversation, updateStateConversationNewMessage } from '../controllers/chatController.js';

const router = express.Router();

// Ruta para obtener todos los chats
router.get('/all-chats', getAllChats);

// Ruta para obtener los mensajes de un chat específico
router.get('/messages/:remoteJid', getChatMessages);

//Ruta para modificar el estado de la conversación
router.put('/state-conversation', updateStateConversation);

// Ruta para actualizar el estado de la conversación al ser clickeado un nuevo mensaje entrante
router.post('/update-chat-state', updateStateConversationNewMessage);

export default router;