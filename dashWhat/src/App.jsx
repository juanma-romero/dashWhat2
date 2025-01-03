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
    
    // Solicitar el historial de mensajes al servidor
    fetch('http://localhost:5000/api/messages/history')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json();
    })
    .then(dataChatList => {setChats(dataChatList)                            
    })
    .catch(error => console.error('Error fetching message history:', error))

    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
    })
    
    // Maneja nuevos mensajes 
    socketRef.current.on('message-from-baileys', (messageData) => {
      setChats((prevChats) => {
        const updatedChats = { ...prevChats };
        const remoteJid = Object.keys(messageData)[0]; // Get the remoteJid
        const newMessage = messageData[remoteJid];      // Get the message object
    
        if (!updatedChats[remoteJid]) {
          updatedChats[remoteJid] = [newMessage];
        } else {
          updatedChats[remoteJid].push(newMessage);
        }
        console.log(updatedChats)
        return updatedChats;
      });
    });
    
    
    
    
    
    return () => {      
      socketRef.current.disconnect()
    }
  }, [])

  const handleChatClick = (remoteJid) => {
    setSelectedChat(remoteJid)
  }

  const handleMessageChange = (e) => {
    setMessageText(e.target.value);
  }

  const handleSendMessage = () => {
    if (selectedChat && messageText) {
      const myWhatsAppNumberInside = myWhatsAppNumber;
      const messageUser = {
        sender: myWhatsAppNumberInside,
        recipient: selectedChat,
        text: messageText,        
        fromMe: true
      }
  
      socketRef.current.emit('send-message-from-frontend', messageUser)
  
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
