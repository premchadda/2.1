import React from 'react';

const AdminLayout = ({ children, className = '' }) => {
  return (
    <div className={`admin-layout ${className}`}>
      <div className="admin-content">
        {children}
      </div>
    </div>
  );
};

export default AdminLayout;