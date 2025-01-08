import React from 'react'
import { ORDER_STATUS } from '../../utils/orderStatus';

const NewOrderForm = ({ selectedChat, deliveryDate, setDeliveryDate, orderItems, addOrderItem, handleProductChange, handleQuantityChange, handleSubmit, observations, setObservations, orderStatus, handleStatusChange, products }) => {
  return (
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
            disabled={!selectedChat}
          >
            {Object.keys(ORDER_STATUS).map(status => (
              <option key={status} value={status} className="bg-gray-700 text-white">
                {status}
              </option>
            ))}
          </select>
          {/* Badge for order status */}
          <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ml-2 ${
            ORDER_STATUS[orderStatus] || 'bg-gray-500 text-white'
          }`}>
            {orderStatus}
          </span>
        </div>
          {/* boton confirma pedido*/}
            <button 
              disabled={!selectedChat} 
              type="submit" className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded float-right">
              Confirmar Pedido
            </button>
        </div>
      </form>
 )
}

export default NewOrderForm