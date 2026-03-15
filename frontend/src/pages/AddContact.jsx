import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { Contact, CheckCircle, Loader2, Phone, Mail, Building2, Folder } from 'lucide-react';

const AddContact = () => {
  const [formData, setFormData] = useState({ department: '', phone: '', email: '', folder: '/' });
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await api.getContacts();
      setContacts(response.data);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.department || !formData.phone || !formData.email) return;

    setLoading(true);
    setSuccess(false);

    try {
      await api.addContact({ ...formData, folder: formData.folder.trim() || '/' });
      setSuccess(true);
      setFormData({ department: '', phone: '', email: '', folder: '/' });
      fetchContacts();
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem' }}>Add Contact</h2>
        <p style={{ color: '#636e72', marginBottom: '2rem' }}>Add official university department contacts for student reference.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={18} color="#4b248b" />
              Target Folder
            </label>
            <input 
              type="text" 
              value={formData.folder}
              onChange={(e) => setFormData({...formData, folder: e.target.value})}
              placeholder="/admissions/2024"
              className="form-control"
              style={{ background: '#f8f9fa' }}
            />
          </div>
          <div className="form-group">
            <label>Department</label>
            <input 
              type="text" 
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              placeholder="e.g., Admissions Office"
              className="form-control"
              required
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input 
              type="text" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+91 863-2344700"
              className="form-control"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="admissions@vignan.ac.in"
              className="form-control"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !formData.department}
            className="btn-primary"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Contact'}
          </button>
        </form>

        {success && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#e1fef4', color: '#27ae60', borderRadius: '12px', textAlign: 'center', fontWeight: '700' }}>
            <CheckCircle size={18} style={{ marginRight: '8px' }} />
            Contact saved successfully!
          </div>
        )}
      </div>

      <div style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '24px', maxHeight: '600px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={20} color="#4b248b" /> Current Directory
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {contacts.map((c) => (
            <div key={c._id} style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: '800', color: '#2d3436', marginBottom: '0.5rem' }}>{c.department}</div>
              <div style={{ fontSize: '0.85rem', color: '#636e72', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Phone size={12} /> {c.phone}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#636e72', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={12} /> {c.email}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddContact;
