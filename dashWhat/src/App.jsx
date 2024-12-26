import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ChatList from './components/ChatList'
import ChatArea from './components/ChatArea'

// Función para agrupar mensajes por contacto
const groupMessagesByContact = (messages) => {
  return messages.reduce((acc, message) => {
    const contact = message.sender;
    if (!acc[contact]) {
      acc[contact] = []
    }
    acc[contact].push(message)
    return acc
  }, {})
}
  
const App = () => {
  const [chats, setChats] = useState({})
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()

  useEffect(() => {
    // Solicitar el historial de mensajes al servidor
    fetch('http://localhost:5000/api/messages/history')
      .then(response => response.json())
      .then(data => {
        const groupedData = groupMessagesByContact(data)
        setChats(groupedData)
      })
      .catch(error => console.error('Error fetching message history:', error))

    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
    })

    // Maneja nuevos mensajes
    socketRef.current.on('new-message', (message) => {
      //console.log('New message received:', message)
      setChats((prevChats) => {
        const contact = message.sender;
        const updatedChats = { ...prevChats }
        
        if (!updatedChats[contact]) {
          updatedChats[contact] = []
        }
        updatedChats[contact].push(message)
    
        // Crea un nuevo objeto de chats asegurando mover el contact al principio
        const orderedChats = { [contact]: updatedChats[contact] }
        Object.keys(updatedChats).forEach((key) => {
          if (key !== contact) {
            orderedChats[key] = updatedChats[key]
          }
        })
    
        return orderedChats
      })
    })
    
    return () => {
      socketRef.current.disconnect()
    }
  }, [])

  const handleChatClick = (chat) => {
    setSelectedChat(chat);
  }

  const handleMessageChange = (e) => {
    setMessageText(e.target.value);
  }

  const handleSendMessage = () => {
    if (selectedChat && messageText) {
      const myWhatsAppNumber = '595985214420@s.whatsapp.net'
      socketRef.current.emit('send-message', {
        sender: myWhatsAppNumber,
        recipient: selectedChat,
        text: messageText,
      })
  
      // Añadir el mensaje enviado al estado de chats en función de recipient
      setChats((prevChats) => {
        const updatedChats = { ...prevChats }
  
        if (!updatedChats[selectedChat]) {
          updatedChats[selectedChat] = []
        }
  
        updatedChats[selectedChat].push({
          sender: myWhatsAppNumber,
          recipient: selectedChat,
          text: messageText,
          timestamp: new Date().toISOString()
        })
  
        return updatedChats
      })
  
      setMessageText('')
    }
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex flex-1 overflow-y-auto">
          <ChatList chats={chats} handleChatClick={handleChatClick} />
          <ChatArea
             selectedChat={selectedChat}
             chats={chats} 
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
