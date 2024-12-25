import './App.css';
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client'; // Importa socket.io-client

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Inicializa la conexión con el servidor de WebSocket
    const socket = io('http://localhost:5000');
        // Lógica de conexión
        socket.on('connect', () => {
          console.log('Connected to WebSocket server');
          setMessage('Connected to WebSocket server');
          
          // Retrasar el envío del mensaje de ping por 10 segundos
        setTimeout(() => {
        socket.emit('ping', { message: 'Hello from client!' });
        console.log('Ping sent to server');
        }, 10000); // 10 segundos de retraso
        });
    
        // Maneja respuesta del servidor
        socket.on('pong', (msg) => {
          console.log('Message from server:', msg);
          setMessage(msg);
        });
    
        // Maneja desconexiones
        socket.on('disconnect', () => {
          console.log('Disconnected from WebSocket server');
          setMessage('Disconnected from WebSocket server');
        });
    
        // Limpieza al desmontar el componente
        return () => socket.disconnect();
      }, []);
      return (
        <>      
          <h1 className="text-3xl font-bold underline">
          Hello world!
          </h1> 
          <div className="App">
            <h2>WebSocket Message: {message}</h2>
          </div>     
        </>
      );
    }
    
    export default App
