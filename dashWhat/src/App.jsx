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
