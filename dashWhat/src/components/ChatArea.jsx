import React, { useState, useEffect } from 'react'

const ChatArea = ({ selectedChat, messageText, handleMessageChange, handleSendMessage }) => {
    const [messages, setMessages] = useState([])

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
            setMessages([]) // Clear messages when no chat is selected
        }
    }, [selectedChat])

    return (
        <div className="flex-1 p-4 bg-slate-500 flex flex-col justify-end h-full overflow-y-auto">
            <div className="space-y-4 flex-1 overflow-y-auto flex flex-col scrollbar-thumb-gray-900 scrollbar-track-gray-100">
                {messages.map((message, index) => (
                    <div
                        key={index} // Use index as key temporarily (not ideal, but since we don't have a unique ID in the message data)
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

            <div className="pt-4"> {/* Added some padding top */}
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

export default ChatArea;

