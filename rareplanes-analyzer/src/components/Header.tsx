import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="container">
        <h1>Rareplanes Dataset Analyzer</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;

