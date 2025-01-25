import React, { useState, useEffect, useRef } from 'react' 
import { io } from 'socket.io-client'
import Header from './components/Header'

//import Header from './components/Header'
import Sidebar from './components/Sidebar/Sidebar'
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
  const [productsLoading, setProductsLoading] = useState(true) // Loading state
  const [productsError, setProductsError] = useState(null) // Error state
  
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
      })
  }, [])

  // conecta socket.io y recibe mensajes desde baileys
  useEffect(() => {
    socketRef.current = io('http://localhost:5000', { transports: ['websocket'] })    
    socketRef.current.on('new-message', (messageData) => {  
      //console.log('Received new message:', messageData)
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex(chat => chat.remoteJid === messageData.key.remoteJid);
        
        if (chatIndex !== -1) {
          const chatActualizado = prevChats[chatIndex];
          //console.log('Chat que recibe el mensaje nuevo:', chatActualizado);
          

        // Crear una copia del chat con el estado actualizado
            const updatedSingleChat = {
              ...chatActualizado,
              stateConversation: messageData.stateConversation
          };
          // Create a new array with the updated chat
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedSingleChat,
            message: messageData.message,
            messageTimestamp: messageData.messageTimestamp,
          }
          
          // Sort the new array
          return updatedChats.sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        } else {
          return [
            {
              remoteJid: messageData.key.remoteJid,
              message: messageData.message,
              messageTimestamp: messageData.messageTimestamp,
              stateConversation: messageData.stateConversation // Use the state from the backend
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
    const fetchChats = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/all-chats');
        const data = await response.json()
        //console.log('Fetched chats:', data)
        setChats(data);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    fetchChats();
  }, [])


  const handleChatClick = async (remoteJid) => {
    setSelectedChat(remoteJid);

  // Actualizar el estado de la conversación en el frontend
  setChats(prevChats => {
    const chatIndex = prevChats.findIndex(chat => chat.remoteJid === remoteJid);
    if (chatIndex !== -1) {
      const chat = prevChats[chatIndex];
      if (chat.stateConversation === 'No leido') {
        const updatedChats = [...prevChats];
        updatedChats[chatIndex] = {
          ...updatedChats[chatIndex],
          stateConversation: 'Atendiendo'
        };
        return updatedChats;
      }
    }
    return prevChats;
  });

  // Actualizar el estado de la conversación en la base de datos
  try {
    const chat = chats.find(chat => chat.remoteJid === remoteJid);
    if (chat && chat.stateConversation === 'No leido') {
      await fetch(`http://localhost:5000/api/update-chat-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remoteJid, stateConversation: 'Atendiendo' }),
      });
    }
  } catch (error) {
    console.error('Error updating chat state:', error);
  }
};

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
  
  const handleStateConversationChange = (remoteJid, newState) => {
    //console.log('Updating state conversation for:', remoteJid, newState)
    setChats(prevChats =>
      prevChats.map(chat =>
        chat.remoteJid === remoteJid ? { ...chat, stateConversation: newState } : chat
      )
    )
  }

  const selectedChatObject = chats.find(chat => chat.remoteJid === selectedChat)

  return (
    <>
    <Header />
    <div className="flex h-screen bg-gray-900">
      <Sidebar 
        selectedChat={selectedChat}
        products={products}
      />         
      <ChatList 
            chats={chats} 
            handleChatClick={handleChatClick}
            selectedChat={selectedChat}            
      />            
          {selectedChat && (
      <ChatArea
            stateConversation={selectedChatObject.stateConversation || 'No leido'}
            messagesRespuesta={messagesRespuesta}
            selectedChat={selectedChat}
            messageText={messageText}
            handleMessageChange={handleMessageChange}
            handleSendMessage={handleSendMessage}
            onStateConversationChange={handleStateConversationChange}           
      />
        )}
        
      
    </div>
    </>
  )
}

export default App
