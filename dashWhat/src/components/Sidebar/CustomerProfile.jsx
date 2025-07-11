import React, { useState, useEffect } from 'react';

const CustomerProfile = ({ customer }) => {
  const [formData, setFormData] = useState({
    name: '',
    whatName: '',
    phone: '',
    RUC: ''
  })
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        whatName: customer.whatName || '',
        phone: customer.phone || '',
        RUC: customer.RUC || ''
      });
    } else {
      setFormData({
        name: '',
        whatName: '',
        phone: '',
        RUC: ''
      });
    }
  }, [customer])

  useEffect(() => {
    return () => {
      if (isEditable) {
        setIsEditable(false);
      }
    };
  }, [customer])

  
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

  const saveChanges = async () => {
    try {
      const response = await fetch('https://backend-service-369596834111.us-central1.run.app/api/customer-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      if (response.ok) {
        // Handle successful response
        toggleEdit()
        console.log('Profile updated successfully');
      } else {
        // Handle error response
        console.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <div className="border border-gray-600 rounded p-4">
      <h3 className="text-lg text-white font-bold mb-2 underline">Datos Cliente</h3>
      <form>
        <table className="w-full">
          <tbody>
            <tr className="mb-2">
              <td className="text-white font-bold">Nombre:</td>
              <td>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="text-xl font-bold p-2 ml-2 rounded w-full"
                  disabled={!isEditable}
                />
              </td>
            </tr>
            <tr className="mb-2">
              <td className="text-gray-400">Nombre Whatsapp:</td>
              <td>
                <input
                  type="text"
                  name="nameWhatsapp"
                  value={formData.whatName}
                  onChange={handleChange}
                  className="text-gray-400 p-2 ml-2 rounded w-full"
                  disabled={!isEditable}
                />
              </td>
            </tr>
            <tr className="mb-2">
              <td className="text-gray-400">Contacto:</td>
              <td>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="text-gray-400 p-2 ml-2 rounded w-full"
                  disabled={!isEditable}
                />
              </td>
            </tr>
            <tr className="mb-2">
              <td className="text-gray-400">RUC:</td>
              <td>
                <input
                  type="text"
                  name="RUC"
                  value={formData.RUC}
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
            onClick={isEditable ? saveChanges : toggleEdit}
            className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            {isEditable ? 'Guardar Cambios' : 'Modificar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerProfile;
