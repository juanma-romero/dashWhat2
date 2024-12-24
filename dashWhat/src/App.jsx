import './App.css'
import React, { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Realiza una petición al servidor Express
    fetch('http://localhost:5000/api/ping')
      .then(response => response.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error("Error fetching data:", err));
  }, []);

  return (
    <>      
      <h1 className="text-3xl font-bold underline">
      Hello world!
      </h1> 
      <div className="App">
      <h2>Message from Backend: {message}</h2>
    </div>     
    </>
  )
}

export default App
