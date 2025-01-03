import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './Header'
import Sidebar from './Sidebar'
import ChatList from './components/ChatList'
import ChatArea from './components/ChatArea'
  
const App = () => {
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messageText, setMessageText] = useState('')
  const socketRef = useRef()
  
  useEffect(() => {
    socketRef.current = io('http://localhost:5000', { transports: ['websocket'] })    
    
    socketRef.current.on('new-message', (messageData) => {      
      setChats((prevChats) => {
        const incomingJid = messageData.key.remoteJid
        const chatIndex = prevChats.findIndex(chat => chat.remoteJid === incomingJid);
        
        if (chatIndex !== -1) {
          // Create a new array with the updated chat
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex],
            message: messageData.message,
            messageTimestamp: messageData.messageTimestamp,
          }
          
          // Sort the new array
          return updatedChats.sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        } else {
          return [
            {
              remoteJid: incomingJid,
              message: messageData.message,
              messageTimestamp: messageData.messageTimestamp,
            },
            ...prevChats,
          ].sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp))
        }
      })
    })
    return () => {
      socketRef.current.disconnect();
    }
  }, [])

  useEffect(() => {
    
    // Solicitar el historial de mensajes al servidor
    fetch('http://localhost:5000/api/all-chats')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json();
    })
    
    .then(dataChatList => {setChats(dataChatList)
    console.log("Data fetched from server:", dataChatList)
    })    
    .catch(error => console.error('Error fetching message history:', error))  
       
  }, [])

  const handleChatClick = (remoteJid) => {
    setSelectedChat(remoteJid)
  }

  const handleMessageChange = (e) => {
    setMessageText(e.target.value);
  }

  const handleSendMessage = () => {
    if (selectedChat && messageText) {
      
      const messageUser = {
        
        recipient: selectedChat,
        text: messageText,        
        fromMe: true
      }
  
      socketRef.current.emit('send-message-from-frontend', messageUser)
  
      // Añadir el mensaje enviado al estado de chats en función de recipient
      setChats((prevChats) => {
        const updatedChats = { ...prevChats }
     
  
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
