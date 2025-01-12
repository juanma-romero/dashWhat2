import React, { useState, useEffect, useRef} from 'react'
import { CONVERSATION_STATUS } from '../utils/orderStatus'

const ChatArea = ({ selectedChat, messageText, handleMessageChange, handleSendMessage, messagesRespuesta, onStateConversationChange, stateConversation: initialStateConversation  }) => {
    const [messages, setMessages] = useState([])       
    let allMessages = [...messages]
    const [stateConversation, setStateConversation] = useState(initialStateConversation || 'No leido')

    useEffect(() => {
      // Actualiza el estado de la conversación cuando selectedChat cambie
      setStateConversation(initialStateConversation || 'No leido');
    }, [initialStateConversation, selectedChat]);

    const handleStateChange = async (newState) => {
                
        try {
          const response = await fetch('http://localhost:5000/api/state-conversation', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              remoteJid: selectedChat,
              stateConversation: newState,
            }),
          })
    
          if (response.ok) {
            setStateConversation(newState)
            //console.log('Calling onStateConversationChange with:', stateConversation)
            onStateConversationChange( selectedChat, newState)
          } else {
            console.error('Error updating state conversation');
          }
        } catch (error) {
          console.error('Error updating state conversation:', error);
        }
    }

    // Scroll to the bottom of the chat area when new messages are added
    const messagesEndRef = useRef(null)

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
    
    // Scroll to the bottom of the chat area when new messages are added
    useEffect(() => {
        // Scroll to the bottom of the messages when they change
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, [allMessages])

    return (
        <div             
            className="flex-1 p-4 bg-gray-700 flex flex-col justify-end h-full overflow-y-auto">
                {selectedChat && ( // Conditionally render the header
                    <div className="mb-4 font-bold text-lg text-white"> 
                        {selectedChat}
                        {/* Toggle button for conversation status */}
                    <div className="flex justify-center items-center mb-4">
                        <div className="flex space-x-2">
                        {Object.keys(CONVERSATION_STATUS).map((status) => (
                            <button
                            key={status}
                            className={`px-4 py-2 rounded-full  ${
                              stateConversation === status ? CONVERSATION_STATUS[status] : 'bg-gray-300'
                            } ${stateConversation === status ? 'ring-2 text-black ring-offset-2 ring-indigo-500' : ''}`}
                            onClick={() => handleStateChange(status)}
                          >
                            {status}
                          </button>
                        ))}
                        </div>
                    </div>
                        

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
                    <div ref={messagesEndRef} />
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
