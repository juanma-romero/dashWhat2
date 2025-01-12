import React, { useState, useEffect } from 'react';
import { ORDER_STATUS } from '../../utils/orderStatus';

const LastOrderSection = ({ lastOrder, lastOrderLoading, lastOrderError }) => {
  const [formData, setFormData] = useState({
    fechaSolicitud: '',
    fechaEntrega: '',
    producto: '',
    cantidad: '',
    estado: ''
  });
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (lastOrder) {
      setFormData({
        fechaSolicitud: new Date(lastOrder.fechaSolicitud).toLocaleString() || '',
        fechaEntrega: new Date(lastOrder.fechaEntrega).toLocaleString() || '',
        producto: lastOrder.producto || '',
        cantidad: lastOrder.cantidad || '',
        estado: lastOrder.estado || ''
      });
    }
  }, [lastOrder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const toggleEdit = () => {
    setIsEditable(!isEditable);
  };

  return (
    <div className="border border-gray-600 rounded p-4 my-4">
    <h3 className="text-lg text-white font-bold mb-2 underline">Ultimo Pedido</h3>
      {lastOrderLoading && <p>Loading last order...</p>}
      {lastOrderError && <p className="text-red-500">Error: {lastOrderError}</p>}
      {lastOrder && (
        <form>
          <table className="w-full">
            <tbody>
              <tr className="mb-2">
                <td className="text-white font-bold">Dia/Hora solicitud:</td>
                <td>
                  <input
                    type="text"
                    name="fechaSolicitud"
                    value={formData.fechaSolicitud}
                    onChange={handleChange}
                    className="text-xl font-bold p-2 ml-2 rounded w-full"
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
                    className="text-gray-400 p-2 ml-2 rounded w-full"
                    disabled={!isEditable}
                  />
                </td>
              </tr>
              <tr className="mb-2">
                <td className="text-gray-400">Producto:</td>
                <td>
                  <input
                    type="text"
                    name="producto"
                    value={formData.producto}
                    onChange={handleChange}
                    className="text-gray-400 p-2 ml-2 rounded w-full"
                    disabled={!isEditable}
                  />
                </td>
              </tr>
              <tr className="mb-2">
                <td className="text-gray-400">Cantidad:</td>
                <td>
                  <input
                    type="text"
                    name="cantidad"
                    value={formData.cantidad}
                    onChange={handleChange}
                    className="text-gray-400 p-2 ml-2 rounded w-full"
                    disabled={!isEditable}
                  />
                </td>
              </tr>
              <tr className="mb-2">
                <td className="text-gray-400">Estado:</td>
                <td>
                  <input
                    type="text"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="text-gray-400 p-2 ml-2 rounded w-full"
                    disabled={!isEditable}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <button
              type="button"
              onClick={toggleEdit}
              className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              {isEditable ? 'Guardar Cambios' : 'Modificar Pedido'}
            </button>
          </div>
        </form>
      )}
      {!lastOrder && !lastOrderLoading && !lastOrderError && (
        <p>No previous orders found.</p>
      )}
    </div>
  );
};

export default LastOrderSection;