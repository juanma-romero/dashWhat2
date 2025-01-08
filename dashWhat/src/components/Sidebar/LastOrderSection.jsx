import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'
import React from 'react';
import { ORDER_STATUS } from '../../utils/orderStatus';

const LastOrderSection = ({ isOrderCollapsed, toggleOrderCollapse, lastOrder, lastOrderLoading, lastOrderError }) => {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggleOrderCollapse}
        className="flex items-center justify-between w-full bg-gray-700 text-white font-medium py-2 px-4 rounded hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-300"
      >
        <span>Ver ultimo pedido</span>
        {isOrderCollapsed ? (
          <ChevronDownIcon className="h-5 w-5" />
        ) : (
          <ChevronUpIcon className="h-5 w-5" />
        )}
      </button>
      {!isOrderCollapsed && (
        <div className="mt-2 border border-gray-600 rounded p-4">
          {lastOrderLoading && <p>Loading last order...</p>}
          {lastOrderError && <p className="text-red-500">Error: {lastOrderError}</p>}
          {lastOrder && (
            <div>
              <p>Dia/Hora solicitud: {new Date(lastOrder.fechaSolicitud).toLocaleString()}</p>
              <p>Dia/Hora entrega: {new Date(lastOrder.fechaEntrega).toLocaleString()}</p>
              <p>Product: {lastOrder.producto}</p>
              <p>Quantity: {lastOrder.cantidad}</p>
              <p>Estado: {lastOrder.estado}</p>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ml-2 ${
                ORDER_STATUS[lastOrder.estado] || 'bg-gray-500 text-white'
              }`}>
                {lastOrder.estado}
              </span>
            </div>
          )}
          {!lastOrder && !lastOrderLoading && !lastOrderError && (
            <p>No previous orders found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LastOrderSection;