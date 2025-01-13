
import React, { useState, useEffect } from 'react'  
import { v4 as uuidv4 } from 'uuid'
import CustomerProfile from './CustomerProfile';
import LastOrderSection from './LastOrderSection';
import NewOrderForm from './NewOrderForm';

const Sidebar = ({ selectedChat, products }) => {
  // states de customer
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)  
  
  // states de ultimo pedido
  const [lastOrder, setLastOrder] = useState(null);
  const [lastOrderLoading, setLastOrderLoading] = useState(false);
  const [lastOrderError, setLastOrderError] = useState(null)

  // state de nuevo pedido
  const [orderItems, setOrderItems] = useState([{ id: uuidv4(), product: '', quantity: 1, price: 0 }]);
  const [observations, setObservations] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderStatus, setOrderStatus] = useState('No leido');

 
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
    <div className="w-1/3 bg-gray-800 p-4 flex flex-col overflow-y-auto">      
      {/* perfil cliente */}
      <CustomerProfile
        className=""
        customer={customer}
      />    
 
      {/* Collapsible Last Order Section */}
      <LastOrderSection 
        products={products}
        className=""
        lastOrder={lastOrder}
        lastOrderLoading={lastOrderLoading}
        lastOrderError={lastOrderError}        
        
      />

      {/* Formulario pedido */}
      <NewOrderForm
        className=""
        selectedChat={selectedChat}
        deliveryDate={deliveryDate}
        setDeliveryDate={setDeliveryDate}
        orderItems={orderItems}
        addOrderItem={addOrderItem}
        handleProductChange={handleProductChange}
        handleQuantityChange={handleQuantityChange}
        handleSubmit={handleSubmit}
        observations={observations}
        setObservations={setObservations}
        orderStatus={orderStatus}
        handleStatusChange={handleStatusChange}
        products={products}
      />
    </div>
  )
}
 
export default Sidebar;
