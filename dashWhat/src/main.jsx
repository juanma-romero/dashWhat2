import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router"
import './index.css'
import App from './App.jsx'
import ListOrders from './ListOrders.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
    <Routes>
      <Route path="/" index element={<App />} />
      <Route path="listado" element={<ListOrders />} />
    </Routes>
    </BrowserRouter>
  </StrictMode>,
)


