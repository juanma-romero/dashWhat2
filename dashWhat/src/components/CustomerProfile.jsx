import React, { useState } from 'react';

const CustomerProfile = ({ customer }) => {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    RUC: customer?.RUC || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  return (
    <div className="h-1/3">
      <form>
        <div className="flex-col items-center mb-4">
          <label className="text-white font-bold">Nombre:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="text-xl text-white font-bold"
          />
          <label className="text-gray-400">Contacto:</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="text-gray-400"
          />
          <label className="text-gray-400">RUC:</label>
          <input
            type="text"
            name="RUC"
            value={formData.RUC}
            onChange={handleChange}
            className="text-gray-400"
          />
        </div>
      </form>
    </div>
  );
};

export default CustomerProfile;