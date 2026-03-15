import React, { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { 
  LayoutDashboard, 
  FilePlus, 
  HelpCircle, 
  Globe, 
  Contact, 
  Database,
  LogOut,
  FolderTree
} from 'lucide-react';

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const adminCredentials = localStorage.getItem('adminCredentials');
    if (!adminCredentials) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminCredentials');
    navigate('/admin/login');
  };

  const menuItems = [
    { name: 'Knowledge Base', path: '/admin', icon: Database },
    { name: 'Ingest PDF', path: '/admin/add-pdf', icon: FilePlus },
    { name: 'Ingest Link', path: '/admin/add-link', icon: Globe },
    { name: 'Ingest FAQ', path: '/admin/add-faq', icon: HelpCircle },
    { name: 'Contacts', path: '/admin/add-contact', icon: Contact },
  ];

  return (
    <div className="app-container">
      <Navbar />
      
      <div className="admin-container">
        <aside className="admin-sidebar" style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)' }}>
          <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderTree size={24} color="#4b248b" />
            <h2 style={{ fontSize: '0.9rem', color: '#4b248b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Admin System</h2>
          </div>
          
          <nav>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin/manage-sources');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`admin-nav-item ${isActive ? 'active' : ''}`}
                  style={{ marginBottom: '0.75rem', borderRadius: '15px' }}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            
            <div style={{ margin: '2rem 0', borderTop: '1px solid #eee' }}></div>

            <button
              onClick={handleLogout}
              className="admin-nav-item"
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff7675', borderRadius: '15px' }}
            >
              <LogOut size={20} />
              <span>Logout Session</span>
            </button>
          </nav>
        </aside>

        <main className="admin-content" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '30px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
