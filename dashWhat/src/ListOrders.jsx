import React, { useState, useEffect} from 'react'
import { ORDER_STATUS } from '../src/utils/orderStatus'

const ListOrders = () => {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchOrdersAndProducts = async () => {
      try {
        const [ordersResponse, productsResponse] = await Promise.all([
          fetch('http://localhost:5000/api/orders'),
          fetch('http://localhost:5000/api/products')
        ]);

        if (!ordersResponse.ok || !productsResponse.ok) {
          throw new Error('Error fetching data');
        }

        const ordersData = await ordersResponse.json();
        const productsData = await productsResponse.json();

        setOrders(ordersData);
        setProducts(productsData);
        
      } catch (error) {       
        console.error('Error fetching data:', error);
      }
    }

    fetchOrdersAndProducts();
  }, [])

  const getProductNameById = (id) => {
    const product = products.find((product) => product._id === id);
    return product ? product.Nombre : 'Producto no encontrado';
  }

  const sortedOrders = orders.sort((a, b) => new Date(a.fechaEntrega) - new Date(b.fechaEntrega))
  return (
    <div className="container mx-auto p-4 bg-gray-900 text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Listado de Pedidos</h1>
      <table className="min-w-full bg-gray-700">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Fecha/Hora Entrega</th>
            <th className="py-2 px-4 border-b">Nombre</th>
            <th className="py-2 px-4 border-b">Producto</th>
            <th className="py-2 px-4 border-b">Cantidad</th>
            <th className="py-2 px-4 border-b">Estado</th>
            <th className="py-2 px-4 border-b">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((order) => (
            <React.Fragment key={order._id}>
            {order.items.map((item, index) => (
              <tr key={index} > 
                {index === 0 && (
                  <>
                    <td className={`py-2 px-4 border-b `} rowSpan={order.items.length}>
                      {new Date(order.fechaEntrega).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2 px-4 border-b" rowSpan={order.items.length}>
                      {order.contactName !== 'Nombre no encontrado' ? order.contactName : order.Phone}
                    </td>
                  </>
                )}
                <td className="py-2 px-4 border-b">{getProductNameById(item._id)}</td>
                <td className="py-2 px-4 border-b">{item.cantidad}</td>
                {index === 0 && (
                  <>
                <td className="py-2 px-4 border-b" rowSpan={order.items.length}>
                  <span className={`px-2 py-1 rounded ${ORDER_STATUS[order.status]}`}>
                    {order.status}
                  </span>
                </td>                    
                <td className="py-2 px-4 border-b" rowSpan={order.items.length}>{order.observations}</td>
                  </>
                )}
              </tr>
            ))}
          </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default ListOrders

//${order.index % 2 === 0 ? 'bg-gray-600' : 'bg-gray-900'}
//className={order.index % 2 === 0 ? 'bg-gray-600' : 'bg-gray-900'}