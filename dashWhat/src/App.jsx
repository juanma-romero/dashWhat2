import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './Header'
import Sidebar from './Sidebar'
//import dotenv from 'dotenv';

//dotenv.config()
const myWhatsAppNumber = '595985214420@s.whatsapp.net'

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

const ChatList = ({ chats, handleChatClick }) => (
  <div className="p-4 w-80 overflow-y-auto bg-slate-600">
    <h2 className="text-xl font-semibold mb-4 text-slate-200">Chats</h2>
    <ul className="space-y-2">
    {Object.entries(chats).map(([contact, messages]) => (
        <li
          key={contact}
          className="p-2 border rounded-md flex items-center cursor-pointer hover:bg-gray-200 "
          onClick={() => handleChatClick(contact)}
        >
          <div className="rounded-full w-10 h-10 mr-3"></div>
          <div>
            <div className="font-bold">{contact}</div>
            <div className="text-sm text-gray-100 hover:text-black">{messages[messages.length - 1].text}</div>
          </div>
        </li>
      ))}
    </ul>
  </div>
)

const ChatArea = ({ selectedChat, chats, messageText, handleMessageChange, handleSendMessage }) => (
  <div className="flex-1 p-4 bg-slate-500 flex flex-col justify-end h-full overflow-y-auto">
    <div className="space-y-4 flex-1 overflow-y-auto flex flex-col-reverse scrollbar-thumb-gray-900 scrollbar-track-gray-100">
    {selectedChat && chats[selectedChat]?.map((message, index) => {
  
  const timeString = messageDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      key={index}
      className={`${
        message.sender === selectedChat ? 'bg-gray-200 text-left' : 'bg-blue-500 text-white text-right'
      } p-3 rounded-lg max-w-xs ${
        message.sender === selectedChat ? '' : 'ml-auto'
      }`}
    >
      <div>{message.text}</div>
      <div className="text-xs text-gray-500">{timeString}</div>
    </div>
  );
})}
    </div>
    {selectedChat && (
      <div className="flex items-center mt-4">
        <input
          type="text"
          placeholder="Escribe tu mensaje"
          className="w-full p-3 border rounded-md"
          value={messageText}
          onChange={handleMessageChange}
        />
        <button
          className="bg-blue-500 text-white p-2 rounded-md ml-2"
          onClick={handleSendMessage}
        >
          Enviar
        </button>
      </div>
    )}
  </div>
)
  
const App = () => {
  const [chats, setChats] = useState({})
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()

  useEffect(() => {
    // Solicitar el historial de mensajes al servidor
    /*fetch('http://localhost:5000/api/messages/history')
      .then(response => response.json())
      .then(data => {
        const groupedData = groupMessagesByContact(data)
        setChats(groupedData)
      })
      .catch(error => console.error('Error fetching message history:', error))
*/
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
    })

    // Maneja nuevos mensajes 
    socketRef.current.on('new-message-from-whatsapp', (message) => {
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
      const myWhatsAppNumberInside = myWhatsAppNumber;
      const messageData = {
        sender: myWhatsAppNumberInside,
        recipient: selectedChat,
        text: messageText,        
        fromMe: true
      }
  
      socketRef.current.emit('send-message-from-frontend', messageData)
  
      // Añadir el mensaje enviado al estado de chats en función de recipient
      setChats((prevChats) => {
        const updatedChats = { ...prevChats }
  
        if (!updatedChats[selectedChat]) {
          updatedChats[selectedChat] = []
        }
  
        updatedChats[selectedChat].push({
          sender: myWhatsAppNumberInside,
          recipient: selectedChat,
          text: messageText,          
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
