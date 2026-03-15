import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogIn, Loader2, GraduationCap } from 'lucide-react';
import api from '../api/api';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await api.verifyAuth(username, password);
      localStorage.setItem('adminCredentials', JSON.stringify({ username, password }));
      navigate('/admin');
    } catch (err) {
      setError('Invalid username or password. Please try again.');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <GraduationCap size={60} color="white" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Vignan Admin</h2>
          <p style={{ opacity: 0.9, fontSize: '1rem', marginTop: '0.5rem' }}>Management Portal Portal</p>
        </div>
        
        <div className="login-body">
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
              <div style={{ padding: '1rem', background: '#fff0f0', color: '#ff7675', borderRadius: '15px', fontSize: '0.9rem', fontWeight: '700', border: '1px solid #ffecec', textAlign: 'center' }}>
                {error}
              </div>
            )}
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#636e72', fontSize: '0.8rem' }}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#b2bec3' }} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="form-control"
                  style={{ paddingLeft: '3.5rem', background: '#f8f9fa', height: '60px' }}
                  placeholder="admin_user"
                />
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#636e72', fontSize: '0.8rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#b2bec3' }} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-control"
                  style={{ paddingLeft: '3.5rem', background: '#f8f9fa', height: '60px' }}
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="btn-primary"
              style={{ height: '60px', marginTop: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderRadius: '15px' }}
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
