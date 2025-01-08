import React from 'react';

const CustomerProfile = ({ customer }) => {
  return (
    <div>
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
    </div>
  );
};

export default CustomerProfile;