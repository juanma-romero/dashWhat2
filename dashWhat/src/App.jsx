import { useState, useEffect, useRef } from 'react' 
import { io } from 'socket.io-client'
import Header from './components/Header'
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
    fetch('https://backend-service-369596834111.us-central1.run.app/api/products')  // Fetch product data
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
    socketRef.current = io('https://backend-service-369596834111.us-central1.run.app', { transports: ['websocket'] })
    socketRef.current.on('new-message', (newMessageData) => {  // newMessageData is the transformedMessage from backend
      //console.log('Received new message:', newMessageData)
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex(chat => chat.remoteJid === newMessageData.key.remoteJid);

        if (chatIndex !== -1) {
          const chatActualizado = prevChats[chatIndex];
          //console.log('Chat que recibe el mensaje nuevo:', chatActualizado);
          

        // Crear una copia del chat con el estado actualizado
            const updatedSingleChat = {
              ...chatActualizado,
              stateConversation: newMessageData.stateConversation
          };
          // Create a new array with the updated chat
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedSingleChat,
            message: 
              newMessageData.type === 'image' 
                ? (newMessageData.caption || '📷 Image') 
              : newMessageData.type === 'contact' || newMessageData.type === 'contact_array'
                ? `👤 Contact: ${newMessageData.contactInfo?.displayName || 'Card'}`
              : newMessageData.type === 'unsupported'
                ? newMessageData.content // Show the "[Unsupported...]" message
              : newMessageData.content, // Default to content for text and others
            messageType: newMessageData.type,
            messageTimestamp: newMessageData.messageTimestamp,
          }
          
          // Sort the new array
          return updatedChats.sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        } else {
          // New chat
          return [
            {
              remoteJid: newMessageData.key.remoteJid,
              message: 
                newMessageData.type === 'image' ? (newMessageData.caption || '📷 Image') 
                : newMessageData.type === 'contact' || newMessageData.type === 'contact_array' ? `👤 Contact: ${newMessageData.contactInfo?.displayName || 'Card'}`
                : newMessageData.type === 'unsupported' ? newMessageData.content
                : newMessageData.content,
              messageType: newMessageData.type,
              messageTimestamp: newMessageData.messageTimestamp,
              stateConversation: newMessageData.stateConversation 
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
        const response = await fetch('https://backend-service-369596834111.us-central1.run.app/api/all-chats');
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
      await fetch(`https://backend-service-369596834111.us-central1.run.app/api/update-chat-state`, {
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
        type: 'text', // Add type for consistency
        content: messageText, // Rename message to content
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
            message: newMessage.content, // Use content for local update
            messageTimestamp: newMessage.messageTimestamp,
            messageType: newMessage.type, // Use type for local update
          }
  
          return updatedChats.sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        } else {
          // This case shouldn't happen ideally, but it's good to handle it
          return [
            {
              remoteJid: selectedChat,
              message: newMessage.content,
              messageType: newMessage.type,
              messageTimestamp: newMessage.messageTimestamp,
            },
            ...prevChats,
          ].sort((a, b) => new Date(b.messageTimestamp) - new Date(a.messageTimestamp));
        }
      })
      // limpia campo de envio de mensaje  
      setMessageText('')
      // carga mensaje en state para renderizar dentro de ChatArea
      if (selectedChat) { 
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
        )
        }
        <Sidebar 
        selectedChat={selectedChat}
        products={products}
      /> 
      
    </div>
    </>
  )
}

export default App
