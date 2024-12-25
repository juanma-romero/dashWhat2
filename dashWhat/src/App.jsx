import React, { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

function App() {
    const [messages, setMessages] = useState([])

    useEffect(() => {
        const socket = io('http://localhost:5000', {
          transports: ['websocket'] // Asegura que el transporte primario sea WebSocket
        }) // Asegúrate de que coincide con el backend

          // Confirmar conexión
        socket.on('connect', () => {
            console.log('Frontend conectado al backend con WebSocket');
        })

        // Escuchar los mensajes desde el backend
        socket.on('new-message', (message) => {
            console.log('Nuevo mensaje recibido:', message);
            setMessages((prevMessages) => [...prevMessages, message]);
        })

        // Limpia la conexión al desmontar el componente
        return () => socket.disconnect()
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold underline">Mensajes</h1>
            <div className="message-list">
                {messages.map((msg, index) => (
                    <div key={index}>
                        <strong>{msg.sender}</strong>: {msg.text} <span>({new Date(msg.timestamp).toLocaleString()})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default App
    
    
    
    /*import './App.css';
    import React, { useState, useEffect } from 'react';
    import { io } from 'socket.io-client';
    
    const socket = io('http://localhost:5000');
    
    function App() {
      const [message, setMessage] = useState('');
      const [messages, setMessages] = useState([]);
      const senderId = "1234567890@s.whatsapp.net"; // Reemplaza con el ID de usuario
    
      useEffect(() => {
        socket.on('connect', () => {
          console.log('Connected to WebSocket server');
        });
    
        socket.on('new-message', (data) => {
          console.log('New message from server:', data);
          setMessages((prevMessages) => [...prevMessages, data]);
        });
    
        socket.on('disconnect', () => {
          console.log('Disconnected from WebSocket server');
        });
    
        return () => {
          socket.off('new-message');
          socket.disconnect();
        };
      }, []);
    
      const handleSendMessage = () => {
        const timestamp = Date.now(); // Obtiene el timestamp actual
        const messageData = {
          sender: senderId,
          text: message,
          receiverId: '0987654321@s.whatsapp.net', // Asigna el ID del destinatario
          timestamp: timestamp,
        };
    
        // Emitir el mensaje al servidor
        socket.emit('send-message', messageData);
        
        // Limpiar el input
        setMessage('');
      };
    
      return (
        <>
          <h1 className="text-3xl font-bold underline">Chat Application</h1>
          <div className="App">
            <div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
              />
              <button onClick={handleSendMessage}>Send Message</button>
            </div>
            <h2>Messages:</h2>
            {messages.map((msg, index) => (
              <div key={index}>
                <strong>{msg.sender}</strong>: {msg.text} <em>{new Date(msg.timestamp).toLocaleString()}</em>
              </div>
            ))}
          </div>
        </>
      );
    }
    
    export default App;*/
