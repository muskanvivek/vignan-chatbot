import React, { useState } from 'react';
import api from '../api/api';
import { Upload, CheckCircle, Loader2, FileText, Info, Folder } from 'lucide-react';

const AddPDF = () => {
  const [file, setFile] = useState(null);
  const [folder, setFolder] = useState('/');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setSuccess(false);
    
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('folder', folder.trim() || '/');

    try {
      await api.ingestPDF(formData);
      setSuccess(true);
      setFile(null);
      setFolder('/');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: '2.5rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', color: '#2d3436' }}>Document Ingestion</h2>
        <p style={{ color: '#636e72', marginBottom: '2.5rem', fontSize: '1rem' }}>Upload university brochures, policies, or handbooks. Our AI will split them into meaningful chunks and index them for precise retrieval.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={18} color="#4b248b" />
              Target Folder
            </label>
            <input 
              type="text" 
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="/admissions/2024"
              className="form-control"
              style={{ background: '#f8f9fa' }}
            />
            <small style={{ color: '#b2bec3', marginTop: '0.5rem', display: 'block' }}>Use / for root, or specify a path like /docs/admissions</small>
          </div>

          <div 
            style={{ 
              border: '2px dashed #ddd', 
              borderRadius: '30px', 
              padding: '5rem 2rem', 
              textAlign: 'center',
              background: file ? 'rgba(75, 36, 139, 0.05)' : 'white',
              borderColor: file ? '#4b248b' : '#eee',
              position: 'relative',
              marginBottom: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => { if(!file) e.currentTarget.style.borderColor = '#4b248b'; }}
            onMouseOut={(e) => { if(!file) e.currentTarget.style.borderColor = '#eee'; }}
          >
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf"
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
            
            <div style={{ 
              width: '80px', 
              height: '80px', 
              background: file ? '#4b248b' : '#f8f9fa', 
              color: file ? 'white' : '#b2bec3',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: file ? '0 10px 20px rgba(75, 36, 139, 0.2)' : 'none'
            }}>
              <Upload size={32} />
            </div>
            
            {file ? (
              <div>
                <div style={{ fontWeight: '800', color: '#4b248b', fontSize: '1.1rem', marginBottom: '0.5rem' }}>{file.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#636e72' }}>Ready to train the AI</div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: '800', color: '#2d3436', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Drop university PDF here</div>
                <div style={{ fontSize: '0.85rem', color: '#b2bec3' }}>Click or drag to upload (Max 20MB)</div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={!file || loading}
            className="btn-primary"
            style={{ height: '60px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderRadius: '15px' }}
          >
            {loading ? (
              <><Loader2 className="animate-spin" size={24} /> Learning from document...</>
            ) : (
              <><FileText size={24} /> Ingest Document</>
            )}
          </button>
        </form>

        {success && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#e1fef4', color: '#27ae60', borderRadius: '15px', textAlign: 'center', fontWeight: '700', border: '1px solid #c3f9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            Document processed and added to knowledge base!
          </div>
        )}
      </div>

      <div style={{ background: '#f8f9fa', padding: '2.5rem', borderRadius: '30px', border: '1px solid #eee' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#2d3436' }}>
          <Info size={22} color="#4b248b" /> Ingestion Tips
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4b248b', marginTop: '6px', flexShrink: 0 }}></div>
            <p style={{ fontSize: '0.9rem', color: '#636e72', lineHeight: '1.6' }}>Ensure PDFs are text-based, not scanned images, for the best extraction quality.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4b248b', marginTop: '6px', flexShrink: 0 }}></div>
            <p style={{ fontSize: '0.9rem', color: '#636e72', lineHeight: '1.6' }}>Large documents are automatically split into 500-character chunks with overlap to maintain context.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4b248b', marginTop: '6px', flexShrink: 0 }}></div>
            <p style={{ fontSize: '0.9rem', color: '#636e72', lineHeight: '1.6' }}>Once uploaded, the document will appear in the <strong>Knowledge Base</strong> section organized by type.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPDF;
