import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ChatList from './components/ChatList'
import ChatArea from './components/ChatArea'
import * as utils from './utils/utils'


const myWhatsAppNumber= '595985214420@s.whatsapp.net'
// Función para agrupar mensajes por contacto
const groupMessagesByContact = (messages) => {
  const grouped = messages.reduce((acc, message) => {
    const contact = message.sender
    if (!acc[contact]) {
      acc[contact] = []
    }
    acc[contact].push(message)
    return acc
  }, {})

  
  // Crear un arreglo de las llaves (contactos) ordenadas por el timestamp del último mensaje
  const orderedKeys = Object.keys(grouped).sort((a, b) => {
    const lastMessageA = grouped[a][grouped[a].length - 1]?.timestamp
    const lastMessageB = grouped[b][grouped[b].length - 1]?.timestamp
    return new Date(lastMessageB) - new Date(lastMessageA)
  })

  // Crear un nuevo objeto ordenado
  const orderedGrouped = {}
  orderedKeys.forEach((key) => {
    orderedGrouped[key] = grouped[key]
  })

  return orderedGrouped
}
  
const App = () => {
  const [chats, setChats] = useState({})
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()

  useEffect(() => {
    fetch('http://localhost:5000/api/messages/history')
      .then(response => response.json())
      .then(data => {
        const groupedData = groupMessagesByContact(data);
        setChats(groupedData)
      })
      .catch(error => console.error('Error fetching message history:', error));
  
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

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex flex-1 overflow-y-auto">
          <ChatList chats={chats} handleChatClick={(chat) => utils.handleChatClick(chat, setSelectedChat)} />
          <ChatArea
            selectedChat={selectedChat}
            chats={chats}
            messageText={messageText}
            handleMessageChange={(e) => utils.handleMessageChange(e, setMessageText)}
            handleSendMessage={() => utils.sendMessage({ selectedChat, messageText, socketRef, myWhatsAppNumber, setChats })}
          />
        </div>
      </div>
    </div>
  )
}

export default App
