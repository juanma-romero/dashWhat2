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
                <div className="space-y-4 flex-1 overflow-y-auto flex flex-col scrollbar-thumb-gray-900 scrollbar-track-gray-100"> {/* `message` is our structured object */}
                    {allMessages.map((msg) => (
                        <div
                            key={msg.key.id} 
                            className={`${
                                msg.key.fromMe ? 'bg-blue-500 text-white text-right ml-auto' : 'bg-gray-200 text-left'
                            } p-3 rounded-lg max-w-xs`}
                        > 
                            {/* Display Quoted Message */}
                            {msg.quotedMessage && (
                                <div className={`p-2 rounded-md mb-2 text-sm ${msg.key.fromMe ? 'bg-blue-400' : 'bg-gray-300'}`}>
                                    <p className="font-semibold">{msg.quotedMessage.senderJid === msg.key.remoteJid ? (msg.pushName || msg.quotedMessage.senderJid.split('@')[0]) : 'You'}</p>
                                    <p className="truncate">{msg.quotedMessage.content}</p>
                                </div>
                            )}

                            {/* Display Main Message Content */}
                            {msg.type === 'text' && (
                                <div>{msg.content}</div>
                            )}
                            {msg.type === 'image' && (
                                <div>
                                    <img src={msg.content} alt={msg.caption || 'Image'} className="max-w-full h-auto rounded mb-1" />
                                    {msg.caption && <p className="text-sm mt-1">{msg.caption}</p>}
                                </div>
                            )}
                            {(msg.type === 'contact' || msg.type === 'contact_array') && msg.contactInfo && (
                                <div className="bg-gray-100 p-3 rounded shadow text-gray-800">
                                    <p className="font-bold text-blue-600">👤 Contact Card</p>
                                    <p><strong>Name:</strong> {msg.contactInfo.displayName}</p>
                                    {msg.contactInfo.phoneNumber && msg.contactInfo.phoneNumber !== 'N/A' && (
                                        <p><strong>Tel:</strong> {msg.contactInfo.fullNumber || msg.contactInfo.phoneNumber}</p>
                                    )}
                                    {/* You could add a button to "Save Contact" or "Message Contact" here */}
                                </div>
                            )}
                            {msg.type === 'unsupported' && (
                                <div className="italic text-gray-500">
                                    {msg.content}
                                </div>
                            )}
                            {/* Fallback for messages that might not have type/content (e.g. old data or unhandled types) */}
                            {!msg.type && msg.message && (
                                 <div>{msg.message}</div>
                            )}

                            <div className="text-xs mt-1 ${msg.key.fromMe ? 'text-gray-300' : 'text-gray-500'}">
                                {new Date(msg.messageTimestamp).toLocaleTimeString(undefined, {
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
