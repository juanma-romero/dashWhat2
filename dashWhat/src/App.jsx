import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './Header'
import Sidebar from './Sidebar'

const ChatList = ({ chats, handleChatClick }) => (
  <div className="p-4 w-80 overflow-y-auto bg-slate-600">
    <h2 className="text-xl font-semibold mb-4 text-slate-200">Mensajes</h2>
    <ul className="space-y-2">
      {chats.map((chat, index) => (
        <li
          key={index}
          className="p-2 border rounded-md flex items-center cursor-pointer hover:bg-gray-200 "
          onClick={() => handleChatClick(chat)}
        >
          <div className="rounded-full w-10 h-10 mr-3"></div>
          <div>
            <div className="font-bold">{chat.sender}</div>
            <div className="text-sm text-gray-100 hover:text-black">{chat.text}</div>
          </div>
        </li>
      ))}
    </ul>
  </div>
)

const ChatArea = ({ selectedChat, messageText, handleMessageChange, handleSendMessage }) => (
  <div className="flex-1 p-4 bg-slate-500 flex flex-col justify-end">
    <div className="space-y-4 flex-1 overflow-y-auto">
      {selectedChat && (
        <>
          <div className="bg-blue-500 text-white p-3 rounded-lg max-w-xs ml-auto">
            {selectedChat.text}
          </div>
          <div className="bg-gray-200 p-3 rounded-lg max-w-xs">
            {/* Aquí podrías cargar más mensajes de la conversación si los tienes */}
            Respuesta del contacto
          </div>
        </>
      )}
    </div>
    {selectedChat && (
      <div className="flex items-center mt-4">
        <input
          type="text"
          placeholder="Type your message"
          className="w-full p-3 border rounded-md"
          value={messageText}
          onChange={handleMessageChange}
        />
        <button
          className="bg-blue-500 text-white p-2 rounded-md ml-2"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    )}
  </div>
)

const App = () => {
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()

  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
    });

    // Maneja nuevos mensajes
    socketRef.current.on('new-message', (message) => {
      console.log('New message received:', message)
      setChats((prevChats) => [
        { ...message },
        ...prevChats.filter((chat) => chat.sender !== message.sender),
      ])
    })
    
    return () => {
      socketRef.current.disconnect()
    }
  }, [])

  const handleChatClick = (chat) => {
    setSelectedChat(chat);
  };

  const handleMessageChange = (e) => {
    setMessageText(e.target.value);
  };

  const handleSendMessage = () => {
    if (selectedChat && messageText) {
      const myWhatsAppNumber = '595985214420@s.whatsapp.net'
      console.log(`Sending message: "${messageText}" to ${selectedChat.sender}`)
      socketRef.current.emit('send-message', {
        sender: myWhatsAppNumber,
        recipient: selectedChat.sender,
        text: messageText,
      })
      setMessageText('')
    }
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex flex-1">
          <ChatList chats={chats} handleChatClick={handleChatClick} />
          <ChatArea
            selectedChat={selectedChat}
            messageText={messageText}
            handleMessageChange={handleMessageChange}
            handleSendMessage={handleSendMessage}            
          />
        </div>
      </div>
    </div>
  )
}

export default App
