import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import React, { useState, useEffect } from 'react'  
import { v4 as uuidv4 } from 'uuid'
import { ORDER_STATUS } from '../utils/orderStatus';

const Sidebar = ({ selectedChat, products }) => {
  // states de customer
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)  
  
  // state de colapsable
  const [isOrderCollapsed, setIsOrderCollapsed] = useState(true)

  // states de ultimo pedido
  const [lastOrder, setLastOrder] = useState(null);
  const [lastOrderLoading, setLastOrderLoading] = useState(false);
  const [lastOrderError, setLastOrderError] = useState(null)

  // state de nuevo pedido
  const [orderItems, setOrderItems] = useState([{ id: uuidv4(), product: '', quantity: 1, price: 0 }]);
  const [observations, setObservations] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderStatus, setOrderStatus] = useState('No leido');

  const toggleOrderCollapse = () => {
    setIsOrderCollapsed(!isOrderCollapsed);
  }

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: uuidv4(), product: '', quantity: 1, price: 0 }])
  }

  const handleProductChange = (index, productId) => {
    setOrderItems(prevItems => {
      const updatedItems = [...prevItems];
      updatedItems[index].product = productId; // Correctly update product ID
      const selectedProduct = products.find(p => p._id === productId); // Find selected product by _id
      updatedItems[index].price = selectedProduct ? selectedProduct.price : 0; // Update price
      return updatedItems;
    });
  }

  const handleQuantityChange = (index, event) => {
    const newQuantity = parseInt(event.target.value, 10) || 0;
    setOrderItems(prevItems => {
      const updatedItems = [...prevItems];
      updatedItems[index].quantity = newQuantity;
      return updatedItems;
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const orderData = {
      Phone: selectedChat,
      fechaSolicitud: new Date().toISOString(),
      fechaEntrega: deliveryDate,
      items: orderItems.map(item => ({
        _id: item.product,
        cantidad: item.quantity
      })),
      observations: observations,
      status: orderStatus
    }    
    
    try {
      const response = await fetch('http://localhost:5000/api/customer/newOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {        
        
        setOrderItems([{ id: uuidv4(), product: '', quantity: 1, price: 0 }]);
        setObservations('');
        setDeliveryDate('');
      } else {
        // Handle error response
        console.error('Failed to submit order');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
    }
    
  }

  const handleStatusChange = (event) => {
    setOrderStatus(event.target.value);
  }

  // carga datos cliente , luego ultimo pedido de ese cliente
  useEffect(() => {
    if (selectedChat) { // Only fetch if selectedChat is not null
      setLoading(true); // Set loading to true before fetching
      setError(null); // Reset any previous error
      setCustomer(null)
      setOrderItems([{ id: uuidv4(), product: '', quantity: 1, price: 0 }])
        fetch(`http://localhost:5000/api/customer/${selectedChat}`)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`) // Throw error for non-2xx responses
              }
              return response.json()
            })
            .then(data => {
                setCustomer(data);
                setLoading(false); // Set loading to false after successful fetch
            })
            .catch(err => {                    
                setError(err.message) // Handle errors
                setLoading(false); // Set loading to false even if an error occurred
                console.error("Fetch error:", err)
            })
            
      // Fetch last order after customer data is fetched successfully
      setLastOrderLoading(true);
      setLastOrderError(null)
      setLastOrder(null)

      fetch(`http://localhost:5000/api/last-order/${selectedChat}`)
        .then(response => {
          if (!response.ok) {
            if (response.status === 404) {
              setLastOrder(null); // Set lastOrder to null to trigger the "No orders" message
          } else {                            
              throw new Error(`HTTP error! status: ${response.status}`); // Throw error for other status codes

          }
          }
          return response.json()
        })
        .then(data => {
        if (data) {
          setLastOrder(data);
        }
        setLastOrderLoading(false)
      })
        .catch(err => {
          setLastOrderError(err.message)
          setLastOrderLoading(false)
          console.error("Error fetching last order:", err)
        })
    } else {
        setCustomer(null) // Reset customer data if selectedChat becomes null
        setLastOrder(null) // Reset last order data as well
        setLastOrderLoading(false)
        setLastOrderError(null)
        
    }
}, [selectedChat])
 
  
  return (
    <div className="w-1/3 bg-gray-800 p-4">
      
      {/* perfil cliente */}
      {customer && ( // Display customer data only when available
        <div>
            <div className="flex items-center mb-4">                    
              <div>
                <h2 className="text-xl text-white font-bold">{customer.name}</h2>
                <p className="text-gray-400">{customer.phone}</p>
              </div>
            </div>
            <p>Nombre: {customer.name}</p>
              {/* ... other customer details ... */}
        </div>
      )}      
 
      {/* Collapsible Last Order Section */}
      <div className="mt-4">  {/* Add some top margin */}
        <button
                    type="button"
                    onClick={toggleOrderCollapse}
                    className="flex items-center justify-between w-full bg-gray-700 text-white font-medium py-2 px-4 rounded hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300"
                >
                    <span>Ver ultimo pedido</span>
                    {/* Toggle icon */}
                    {isOrderCollapsed ? (
                        <ChevronDownIcon className="h-5 w-5" />
                    ) : (
                        <ChevronUpIcon className="h-5 w-5" />
                    )}                    
        </button>
        {/* Conditionally render the last order details */}
        {!isOrderCollapsed && ( // Show when not collapsed
        <div className="mt-2 border border-gray-600 rounded p-4"> {/* Styling */}
                        {lastOrderLoading && <p>Loading last order...</p>}
                        {lastOrderError && <p className="text-red-500">Error: {lastOrderError}</p>}
                        {lastOrder && (
                            <div>
                                <p>Date: {new Date(lastOrder.fechaSolicitud).toLocaleString()}</p> {/* Format date */}
                                <p>Delivery Date: {new Date(lastOrder.fechaEntrega).toLocaleString()}</p>
                                <p>Product: {lastOrder.producto}</p>
                                <p>Quantity: {lastOrder.cantidad}</p>
                                <p>Status: {lastOrder.estado}</p>
                                {/* ... display other order details ... */}
                            </div>
                        )}
                        {!lastOrder && !lastOrderLoading && !lastOrderError && ( // Show when no orders are found after loading is complete and there are no errors
                            <p>No previous orders found.</p>
                        )}


        </div>
        )}
      </div>

      {/* Formulario pedido */}
      <form onSubmit={handleSubmit}>
        <h3 className="text-lg text-white font-bold mb-2">Nuevo Pedido</h3>
        {/* Fecha y Hora */}
        <div className="mb-4">
          <label className="block text-white mb-1" htmlFor="orderDate">Fecha y Hora</label>
          <input
            disabled={!selectedChat}
            placeholder="dd/mm/aaaa"
            type="datetime-local"
            id="deliveryDate"
            name="deliveryDate"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full p-2 border border-gray-600 rounded"
          />
        </div>
        {/* Selecciona Productos y cantidades */}
        {orderItems.map((item, index) => (
              <div key={item.id} className="flex mb-2">
                  <select
                      value={item.product}  // Bind to item.product (which will store _id as string)
                      onChange={e => handleProductChange(index, e.target.value)} // Pass the product._id as String
                      className="w-1/2 p-2 border border-gray-600 rounded mr-2"
                      disabled={!selectedChat}
                  >
                   <option value="">Seleccione Producto</option>
                    {products.map(product => ( // Map over the products array
                        <option key={product._id} value={product._id}>  {/* Use product.id for key and value */}
                            {product.Nombre} {/* Access nombre property of each product */}
                        </option>
                    ))} 
                </select>
                <span className="w-1/4 p-2 text-center border border-gray-600 rounded mr-2 bg-white"> {/* Added span */}
                  {item.price}  {/* Display item.price */}
                </span>

                 <input
                    disabled={!selectedChat}
                    type="number"
                    min="0" // Prevent negative numbers
                    value={item.quantity}
                    onChange={e => handleQuantityChange(index, e)}
                    className="w-1/4 p-2 border border-gray-600 rounded mr-2"
                />
                 <span className="w-1/4 p-2 text-center border border-gray-600 rounded bg-white">
                    {item.quantity * item.price}
                </span>
             </div>
        ))}
        <div className="flex justify-end mt-4">
          <span className="text-white font-bold">Total: </span>
          <span className="ml-2 text-white font-bold">
            {orderItems.reduce((total, item) => total + item.quantity * item.price, 0)}
          </span>
        </div>
        
          {/* Boton agregar producto*/}
          <button 
            disabled={!selectedChat}
            type="button" 
            onClick={addOrderItem} 
            className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Agregar Producto
          </button>
          {/* Observaciones */}
            <div className="mb-4 mt-4">
              <label className="block text-white mb-1" htmlFor="observations">Observaciones</label>
              <textarea
                disabled={!selectedChat}
                id="observations"
                name="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="w-full p-2 border border-gray-600 rounded"
              />
            {/* Estado del Pedido */}
            <div className="mt-4">
            <span className="text-white font-bold">Estado del Pedido: </span>
            <select
              value={orderStatus}
              onChange={handleStatusChange}
              className="mt-2 bg-gray-700 text-white font-bold py-2 px-4 rounded-full appearance-none"
            >
              {Object.values(ORDER_STATUS).map(status => (
                <option key={status} value={status} className="bg-gray-700 text-white">
                  {status}
                </option>
              ))}
            </select>            
          </div>
          {/* boton confirma pedido*/}
            <button 
              disabled={!selectedChat} 
              type="submit" className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded float-right">
              Confirmar Pedido
            </button>

        </div>
      </form>
    </div>
  )
}

export default Sidebar;
