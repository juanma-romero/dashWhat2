
export const handleChatClick = (chat, setSelectedChat) => {
    setSelectedChat(chat)
}

  
// Más lógica para ayudar con handleMessageChange
export const handleMessageChange = (e, setMessageText) => {
    setMessageText(e.target.value);
}
  
// Parte de la lógica es abstracta para manejar el envío de mensajes
export const sendMessage = ({ selectedChat, messageText, socketRef, myWhatsAppNumber, setChats }) => {
    if (selectedChat && messageText) {
      socketRef.current.emit('send-message', {
        sender: myWhatsAppNumber,
        recipient: selectedChat,
        text: messageText,
    })
  
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
    }
}