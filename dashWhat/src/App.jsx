import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ChatList from './components/ChatList'
import ChatArea from './components/ChatArea'

const App = () => {
  // para listado de chats y seleccion de chats
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  
  const socketRef = useRef(null)

  // para mensajes de usuario enviado
  const [messagesRespuesta, setMessagesRespuesta] = useState([])
  const [messageText, setMessageText] = useState('') 
  
  // para manejar listado productos
  const [products, setProducts] = useState([]); // State to store products
  const [productsLoading, setProductsLoading] = useState(true); // Loading state
  const [productsError, setProductsError] = useState(null); // Error state
  
  // carga productos y precio unit al inicio de sesion
  useEffect(() => {
    setProductsLoading(true);
    setProductsError(null);
    fetch('http://localhost:5000/api/products')  // Fetch product data
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setProducts(data);
        setProductsLoading(false);
      })
      .catch(error => {
        setProductsError(error.message);
        setProductsLoading(false);
        console.error("Error fetching products:", error);
      });
  }, []); // Empty dependency array ensures this runs only once on mount

  // conecta socket.io y recibe mensajes desde baileys
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

  // Solicitar el historial de mensajes al servidor
  useEffect(() => {    
    fetch('http://localhost:5000/api/all-chats')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json();
    })
    
    .then(dataChatList => {setChats(dataChatList)
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
      //construye mensaje a enviar
      const newMessage = {
        key: {
          fromMe: true,
          remoteJid: selectedChat,
          id: Math.random().toString(36).substring(2, 15), // Temporary client-side ID
        },
        message: messageText, 
        messageTimestamp: new Date().toISOString(),
        remoteJid: selectedChat        
      }      
      
      //envia mensaje a backend
      socketRef.current.emit('send-message-from-frontend',newMessage)
      //actualiza ChatList
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((chat) => chat.remoteJid === selectedChat);
  
        if (chatIndex !== -1) {
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex], 
            message: newMessage.message,     
            messageTimestamp: newMessage.messageTimestamp,
          }
  
          return updatedChats.sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        } else {
          // This case shouldn't happen ideally, but it's good to handle it
          return [
            {
              remoteJid: selectedChat,
              message: newMessage.message,
              messageTimestamp: newMessage.messageTimestamp,
            },
            ...prevChats,
          ].sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        }
      })
      // limpia campo de envio de mensaje  
      setMessageText('')
      // carga mensaje en state para renderizar dentro de ChatArea
      if (selectedChat) { // Check if a chat is selected
        setMessagesRespuesta(prevMessages => [...prevMessages, newMessage])
      }
    }
  }
  

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar 
        selectedChat={selectedChat}
        products={products}
        />
      <div className="flex flex-col flex-1">
        <Header />
        <div className="flex flex-1 overflow-y-auto">
          <ChatList 
            chats={chats} 
            handleChatClick={handleChatClick}
            selectedChat={selectedChat}
            
            />
          <ChatArea
            messagesRespuesta={messagesRespuesta}
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
