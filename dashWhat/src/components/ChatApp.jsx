import React, { useState } from 'react';

const ChatApp = () => {
  const [selectedChat, setSelectedChat] = useState(null);

  const handleChatClick = (remoteJid) => {
    setSelectedChat(remoteJid);
  };

  return (
    <div>nada</div>
  )
}

export default ChatApp;
