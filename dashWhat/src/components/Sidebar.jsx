import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import React, { useState, useEffect } from 'react'  
import { v4 as uuidv4 } from 'uuid'

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
  const [orderItems, setOrderItems] = useState([{ product: '', quantity: 1, price: 0 }])

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

  // carga datos cliente , luego ultimo pedido de ese cliente
  useEffect(() => {
    if (selectedChat) { // Only fetch if selectedChat is not null
      setLoading(true); // Set loading to true before fetching
      setError(null); // Reset any previous error
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
      setLastOrderError(null);
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
          if(data){
          setLastOrder(data)}
          setLastOrderLoading(true)
         
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
      {loading && <p>Loading customer data...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}
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
      <form>
        <h3 className="text-lg text-white font-bold mb-2">Nuevo Pedido</h3>
        {orderItems.map((item, index) => (
                    <div key={item.id} className="flex mb-2">
                        <select
                            value={item.product}  // Bind to item.product (which will store _id as string)
                            onChange={e => handleProductChange(index, e.target.value)} // Pass the product._id as String
                            className="w-1/2 p-2 border border-gray-600 rounded mr-2"
                        >
                            <option value="">Seleccione Producto</option>
                            {products.map(product => ( // Map over the products array
                                <option key={product._id} value={product._id}>  {/* Use product.id for key and value */}
                                    {product.Nombre} {/* Access nombre property of each product */}

                                </option>
                            ))}
                        </select>
                        <span className="w-1/4 p-2 text-center border border-gray-600 rounded mr-2"> {/* Added span */}
                          {item.price}  {/* Display item.price */}
                        </span>
                        <input
                            type="number"
                            min="0" // Prevent negative numbers
                            value={item.quantity}
                            onChange={e => handleQuantityChange(index, e)}
                            className="w-1/4 p-2 border border-gray-600 rounded mr-2"
                        />
                        <span className="w-1/4 p-2 text-center border border-gray-600 rounded">
                            {item.quantity * item.price}
                        </span>
                    </div>
                ))}
                <button type="button" onClick={addOrderItem} className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  Agregar Producto
                </button>        
      </form>
    </div>
  )
}

export default Sidebar;
