import React, { useState, useEffect } from 'react';
import { ORDER_STATUS } from '../../utils/orderStatus';

const LastOrderSection = ({ lastOrder, lastOrderLoading, lastOrderError, products }) => {
  const [formData, setFormData] = useState({
    idOrder: '',
    fechaSolicitud: '',
    fechaEntrega: '',
    items:[],
    status: ''
  })

  const [modOk, setModOk] = useState('')
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (lastOrder) {
      setFormData({
        idOrder: lastOrder._id || '',
        fechaSolicitud: lastOrder.fechaSolicitud ? new Date(lastOrder.fechaSolicitud).toLocaleString() : '',
        fechaEntrega: lastOrder.fechaEntrega ? new Date(lastOrder.fechaEntrega).toLocaleString() : '',
        items: lastOrder.items ? lastOrder.items.map(item => ({
          _id: item._id,
          cantidad: item.cantidad
        })) : [],
        status: lastOrder.status || ''
      });
    }
  }, [lastOrder])

  useEffect(() => {
    setModOk('');
  }, [formData]);

  const handleStatusChange = (e) => {
    setFormData({
      ...formData,
      status: e.target.value
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const [field, index] = name.split('_');
    const updatedProductos = [...formData.items];
    updatedProductos[index][field] = value;
    setFormData({
      ...formData,
      items: updatedProductos
    })  
    //console.log(formData);  
  }

  const toggleEdit = () => {
    setIsEditable(!isEditable);
  };

  const getProductName = (id) => {
    const product = products.find(product => product._id === id);
    return product ? product.Nombre : 'Producto no encontrado';
  }

  const handleSaveChanges = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      if (!response.ok) {
        throw new Error('Error al guardar los cambios');
      }
      const result = await response.json()
      setModOk('Cambios guardados correctamente')
      //console.log('Cambios guardados:', result);
      toggleEdit();
    } catch (error) {
      setModOk('Error al guardar cambios');
    }
  }

  return (
    <div className="border border-gray-600 rounded p-4 my-4">
    <h3 className="text-lg text-white font-bold mb-2 underline">Ultimo Pedido</h3>
      {lastOrderLoading && <p>Loading last order...</p>}
      {lastOrderError && <p className="text-red-500">Error: {lastOrderError}</p>}
      {modOk && <p className="text-green-500 right-3">{modOk}</p>}
      {lastOrder && (
        <form>
          <table className="w-full">
            <tbody>
              <tr className="mb-2">
                <td className="text-gray-400">Dia/Hora solicitud:</td>
                <td>
                  <input
                    type="text"
                    name="fechaSolicitud"
                    value={formData.fechaSolicitud}
                    onChange={handleChange}
                    className="text-gray-400 p-2 ml-2 rounded w-30"
                    disabled={!isEditable}
                  />
                </td>
              </tr>
              <tr className="mb-2">
                <td className="text-gray-400">Dia/Hora entrega:</td>
                <td>
                  <input
                    type="text"
                    name="fechaEntrega"
                    value={formData.fechaEntrega}
                    onChange={handleChange}
                    className="font-bold  p-2 ml-2 rounded w-30"
                    disabled={!isEditable}
                  />
                </td>
              </tr>             
                {formData.items && formData.items.map((producto, index) => (
                <React.Fragment key={index}>
                <tr className="mb-2">
                  <td className="text-gray-400">Producto:</td>
                  <td>
                    {isEditable ? (
                      <select
                        name={`_id_${index}`}
                        value={producto._id}
                        onChange={handleChange}
                        className="text-gray-400 p-2 ml-2 rounded w-30"
                      >
                        {products.map(product => (
                          <option key={product._id} value={product._id}>
                            {product.Nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name={`_id_${index}`}
                        value={getProductName(producto._id)}
                        onChange={handleChange}
                        className="text-gray-400 p-2 ml-2 rounded w-30"
                        disabled
                      />
                    )}
                  </td>                
                  <td className="text-gray-400">Cantidad:</td>
                  <td>
                    <input
                      type="number"
                      name={`cantidad_${index}`}
                      value={producto.cantidad}
                      onChange={handleChange}
                      className="text-gray-400 p-2 ml-2 rounded w-14"
                      disabled={!isEditable}
                    />
                  </td>
                </tr>
              </React.Fragment>
              ))}
              <tr className="mb-2">
                <td className="text-gray-400">Estado:</td>
                <td>
                <select
                    name="status"
                    value={formData.status}
                    onChange={handleStatusChange}
                    className={`text-gray-400 p-2 ml-2 rounded w-30 ${ORDER_STATUS[formData.status]}`}
                    disabled={!isEditable}
                  >
                    {Object.keys(ORDER_STATUS).map(status => (
                      <option key={status} value={status} className={ORDER_STATUS[status]}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          
        </form>
      )}
      <button
        type="button"
        onClick={isEditable ? handleSaveChanges : toggleEdit}
        className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        {isEditable ? 'Guardar Cambios' : 'Modificar Pedido'}
      </button>
      {!lastOrder && !lastOrderLoading && !lastOrderError && (
        <p>No previous orders found.</p>
      )}
    </div>
  );
};

export default LastOrderSection;