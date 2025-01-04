import express from 'express';
const app = express();
const port = process.env.PORT 

// Mock data
const mockChats = [
    { remoteJid: "user1@s.whatsapp.net", message: "Hola", messageTimestamp: "2024-05-29T12:00:00Z" },
    { remoteJid: "user2@s.whatsapp.net", message: "Como estas", messageTimestamp: "2024-05-29T13:00:00Z" }
];

app.get('/api/all-chats', (req, res) => {
    res.json(mockChats);
});

app.listen(port, () => {
    console.log(`Placeholder backend listening on port ${port}`);
});
