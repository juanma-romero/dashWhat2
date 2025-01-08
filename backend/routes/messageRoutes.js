import express from 'express'
import { storeMessage } from '../controllers/messageController.js'

const router = express.Router()

// Ruta para almacenar mensajes
router.post('/messages', storeMessage)

export default router