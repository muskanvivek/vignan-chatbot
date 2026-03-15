import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  
  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <GraduationCap size={32} />
        <span>Vignan Support AI</span>
      </Link>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          Chatbot
        </Link>
        {/* Admin link removed from public navbar per request */}
      </div>
    </nav>
  );
};

export default Navbar;
