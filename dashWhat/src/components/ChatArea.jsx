import React, { useState, useEffect} from 'react'

const ChatArea = ({ selectedChat, messageText, handleMessageChange, handleSendMessage, messagesRespuesta }) => {
    const [messages, setMessages] = useState([])       
    let allMessages = [...messages]

    if (messagesRespuesta && messagesRespuesta.length > 0) {
      allMessages = [...messages, ...messagesRespuesta]
    }

    useEffect(() => {
        if (selectedChat) {
            const fetchMessages = async () => { 
                try {
                    const response = await fetch(`http://localhost:5000/api/messages/${selectedChat}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }
                    const data = await response.json();
                    setMessages(data);
                } catch (error) {
                    console.error('Error fetching messages:', error)
                }
            }

            fetchMessages()
        } else {
            setMessages([]) 
        }
    }, [selectedChat])   
    
    return (
        <div             
            className="flex-1 p-4 bg-gray-700 flex flex-col justify-end h-full overflow-y-auto">
                {selectedChat && ( // Conditionally render the header
                    <div className="mb-4 font-bold text-lg text-white"> 
                        {selectedChat}
                    </div>
                )}
                <div className="space-y-4 flex-1 overflow-y-auto flex flex-col scrollbar-thumb-gray-900 scrollbar-track-gray-100">
                    {allMessages.map((message) => (
                        <div
                            key={message.key.id} // Use WhatsApp ID if available, otherwise clientId
                            className={`${
                                message.key.fromMe ? 'bg-blue-500 text-white text-right ml-auto' : 'bg-gray-200 text-left'
                            } p-3 rounded-lg max-w-xs`}
                        >
                            <div>{message.message}</div>
                            <div className="text-xs text-gray-500">
                                {new Date(message.messageTimestamp).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4"> 
                    <input
                        type="text"
                        className="p-2 w-full rounded-md border border-gray-300"
                        placeholder="Escribi tu mensaje..."
                        value={messageText}
                        onChange={handleMessageChange}
                    />
                    <button className="bg-blue-500 text-white p-2 rounded-md mt-2 w-full" onClick={handleSendMessage}>Enviar</button>
                </div>
        </div>
    )
}

export default ChatArea
