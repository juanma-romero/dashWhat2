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

export default ChatArea