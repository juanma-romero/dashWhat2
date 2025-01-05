import React, { useState } from 'react'
import imgUrl from '/juanmaAI.png'

const Sidebar = () => {
  const [orderStatus, setOrderStatus] = useState('No Leído')
  const customerData = {
    name: "Juanma Romero",
    ruc: "5120189-5",
    imageUrl: imgUrl, // Placeholder image URL
    contact: "595981123123", // Replace with a realistic number
  }
  const statusOptions = [
    { value: 'No Leído', color: 'bg-red-500' },
    { value: 'Confirmado', color: 'bg-green-500' },
    { value: 'Entregado', color: 'bg-blue-400' }, // Use a blue that is more visually distinct.
    // Add more status options as needed.
  ]

  const orderItems = [
    { product: 'Producto 1', quantity: 2, price: 15.50 },
    { product: 'Producto 2', quantity: 1, price: 20.00 },
  ];

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => total + item.quantity * item.price, 0);
  };

  return (
    <div className="w-1/3 bg-gray-800 p-4">
      <div className="flex items-center mb-4">
        <img
          src={customerData.imageUrl}
          alt="Profile"
          className="w-12 h-12 rounded-full mr-4"
        />
        <div>
          <h2 className="text-xl text-white font-bold">{customerData.name}</h2>
          <p className="text-gray-400">{customerData.ruc}</p>
          <p className="text-gray-400">{customerData.contact}</p>
        </div>
      </div>

      <form> {/* Form structure remains, no actual submission */}
        <h3 className="text-lg text-white font-bold mb-2">Nuevo Pedido</h3>
        <input type="date" className="w-full p-2 border border-gray-600 rounded mb-2" />

        {orderItems.map((item, index) => (
          <div key={index} className="mb-2">
            <input
              type="text"
              value={item.product}
              readOnly // Prevent editing for now
              className="w-full p-2 border border-gray-600 rounded mb-1"
            />
            <div className="flex">
              <input
                type="number"
                value={item.quantity}
                readOnly
                className="w-1/3 p-2 border border-gray-600 rounded mr-2"
              />
              <input
                type="number"
                value={item.price}
                readOnly
                className="w-1/3 p-2 border border-gray-600 rounded mr-2"
              />
              <span className="w-1/3 p-2 text-center border border-gray-600 rounded">
                {item.quantity * item.price}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-4"> {/* Add some spacing */}
          <label htmlFor="orderStatus" className="block text-white mb-2">Estado del Pedido:</label> {/* Add a label */}
          <select
            id="orderStatus"
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="w-full p-2 border border-gray-600 rounded appearance-none" // Remove default appearance
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value}
              </option>
            ))}
          </select>

          {/* Pill button display */}
          <div className={`mt-2 inline-block px-3 py-1 rounded-full text-white ${statusOptions.find(opt => opt.value === orderStatus)?.color}`}>
            {/* Find the corresponding color class for the selected status */}
            {orderStatus} 
          </div>
        </div>

        <div className="font-bold text-white mt-4">Total: {calculateTotal()}</div>
      </form>
    </div>
  );
};

export default Sidebar;
