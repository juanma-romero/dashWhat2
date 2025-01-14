import React from 'react'

const ListOrders = () => {
  const orders = [
    {
      id: 1,
      fechaEntrega: '2023-10-01',
      nombre: 'Juan Perez',
      productos: [
        { nombre: 'Producto A', cantidad: 2 },
        { nombre: 'Producto B', cantidad: 1 },
      ],
      observaciones: 'Entregar en la mañana',
    },
    {
      id: 2,
      fechaEntrega: '2023-10-02',
      nombre: 'Maria Lopez',
      productos: [
        { nombre: 'Producto C', cantidad: 3 },
      ],
      observaciones: 'Llamar antes de entregar',
    },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Listado de Pedidos</h1>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Fecha Entrega</th>
            <th className="py-2 px-4 border-b">Nombre</th>
            <th className="py-2 px-4 border-b">Producto</th>
            <th className="py-2 px-4 border-b">Cantidad</th>
            <th className="py-2 px-4 border-b">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <React.Fragment key={order.id}>
              {order.productos.map((producto, index) => (
                <tr key={index}>
                  {index === 0 && (
                    <>
                      <td className="py-2 px-4 border-b" rowSpan={order.productos.length}>{order.fechaEntrega}</td>
                      <td className="py-2 px-4 border-b" rowSpan={order.productos.length}>{order.nombre}</td>
                    </>
                  )}
                  <td className="py-2 px-4 border-b">{producto.nombre}</td>
                  <td className="py-2 px-4 border-b">{producto.cantidad}</td>
                  {index === 0 && (
                    <td className="py-2 px-4 border-b" rowSpan={order.productos.length}>{order.observaciones}</td>
                  )}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ListOrders;