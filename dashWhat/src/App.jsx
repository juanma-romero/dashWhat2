import React, { useState, useEffect, useRef  } from 'react'
import { io } from 'socket.io-client'



const App = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()

  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'], 
    })

    // maneja nuevos mensajes
    socketRef.current.on('new-message', (message) => {
      console.log('New message received:', message);
      setChats((prevChats) => [
        { ...message },
        ...prevChats.filter((chat) => chat.sender !== message.sender),
      ])
    })

    return () => {
      socketRef.current.disconnect();
    }
  }, [])

  const handleChatClick = (chat) => {
    setSelectedChat(chat);
  };

  const handleMessageChange = (e) => {
    setMessageText(e.target.value)
  };

  const handleSendMessage = () => {
    if (selectedChat && messageText) {
      const myWhatsAppNumber = '595985214420@s.whatsapp.net';

      console.log(`Sending message: "${messageText}" to ${selectedChat.sender}`);
      socketRef.current.emit('send-message', {
        sender: myWhatsAppNumber,
        recipient: selectedChat.sender,
        text: messageText,
      })
      setMessageText('')
    }
  }

  return (
         <div className="max-w-md mx-auto p-4">
          <h1 className="text-2xl font-semibold mb-4">Chat</h1>
          <ul className="space-y-2 mb-4">
            {chats.map((chat, index) => (
          <li
            key={index}
            className="border p-2 rounded cursor-pointer hover:bg-gray-200"
            onClick={() => handleChatClick(chat)}
          >
            <div className="font-bold">{chat.sender}</div>
            <div className="text-gray-600 truncate">{chat.text}</div>
            <div className="text-gray-400 text-xs">
              {new Date(chat.timestamp).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
      {selectedChat && (
        <div className="border-t pt-2">
          <div className="font-bold mb-2">{selectedChat.sender}</div>
          <textarea
            className="w-full border rounded p-2 mb-2"
            rows="4"
            placeholder="Escribe tu mensaje..."
            value={messageText}
            onChange={handleMessageChange}
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={handleSendMessage}
          >
            Enviar
          </button>
        </div>
      )}
    </div>
    )
}

export default App   