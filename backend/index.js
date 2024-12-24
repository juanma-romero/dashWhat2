const express = require('express')
const cors = require('cors')// Permite el acceso CORS
const bodyParser = require('body-parser')

const app = express()
const PORT = process.env.PORT || 5000

// Usar CORS para permitir llamadas desde el front-end
app.use(cors())
app.use(bodyParser.json())

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' })
})

app.post('/api/messages', (req, res) => {
    const messageData = req.body
    console.log('Message received from Baileys:', messageData)
    // Procesa el mensaje según sea necesario
    res.sendStatus(200)
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
});