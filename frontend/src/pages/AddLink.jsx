import React, { useState } from 'react';
import api from '../api/api';
import { Globe, CheckCircle, Loader2, Sparkles, Layout, Folder, Zap } from 'lucide-react';

const AddLink = () => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('/');
  const [loading, setLoading] = useState(false);
  const [isDeepCrawl, setIsDeepCrawl] = useState(false);
  const [success, setSuccess] = useState(false);
  const [crawlStats, setCrawlStats] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setSuccess(false);
    setCrawlStats(null);

    try {
      if (isDeepCrawl) {
        const response = await api.ingestDeepURL(url, folder.trim() || '/');
        setSuccess(true);
        setCrawlStats({ count: response.data.processedCount });
      } else {
        await api.ingestURL(url, name, folder.trim() || '/');
        setSuccess(true);
      }
      setUrl('');
      setName('');
      setFolder('/');
    } catch (error) {
      console.error('Ingestion failed:', error);
      alert('Ingestion failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const universityLinks = [
    { name: 'Official Website', url: 'https://vignan.ac.in/' },
    { name: 'Admissions 2024', url: 'https://vignan.ac.in/admissions' },
    { name: 'Fee Structure', url: 'https://vignan.ac.in/feestructure' },
    { name: 'Placement Stats', url: 'https://vignan.ac.in/placements' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', color: '#2d3436' }}>Web Content Ingestion</h2>
        <p style={{ color: '#636e72', marginBottom: '2.5rem', fontSize: '1rem' }}>Enter a university website URL. Our AI will automatically crawl, clean, and index the readable text for the chatbot.</p>

        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', border: '1px solid #eee', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div className="form-group">
            <label style={{ color: '#2d3436', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={18} color="#4b248b" />
              Target Folder
            </label>
            <input 
              type="text" 
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="/admissions/2024"
              className="form-control"
              style={{ height: '55px', background: '#f8f9fa' }}
            />
            <small style={{ color: '#b2bec3', marginTop: '0.5rem', display: 'block' }}>Use / for root, or specify a path like /docs/admissions</small>
          </div>

          <div className="form-group">
            <label style={{ color: '#2d3436', fontWeight: '700' }}>Display Name (Optional)</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Admissions 2024 Details"
              className="form-control"
              style={{ height: '55px', background: '#f8f9fa' }}
            />
          </div>

          <div className="form-group">
            <label style={{ color: '#2d3436', fontWeight: '700' }}>Website URL</label>
            <input 
              type="url" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://vignan.ac.in/page-name"
              className="form-control"
              style={{ height: '55px', background: '#f8f9fa' }}
              required
            />
          </div>

          <div style={{ marginBottom: '2rem', background: isDeepCrawl ? 'rgba(75, 36, 139, 0.05)' : '#f8f9fa', padding: '1.25rem', borderRadius: '18px', border: '1px solid', borderColor: isDeepCrawl ? '#4b248b' : '#eee', transition: 'all 0.3s' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isDeepCrawl} 
                onChange={(e) => setIsDeepCrawl(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#4b248b' }}
              />
              <div>
                <div style={{ fontWeight: '700', color: '#2d3436', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Deep Crawl & Train <Zap size={14} fill="#fbc02d" color="#fbc02d" />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#636e72' }}>Automatically discover and ingest all sub-links from this URL</div>
              </div>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={!url || loading}
            className="btn-primary"
            style={{ height: '55px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
            {loading ? (isDeepCrawl ? 'Crawling Multiple Pages...' : 'Crawling & Training AI...') : (isDeepCrawl ? 'Deep Ingest Website' : 'Ingest Web Content')}
          </button>
        </form>

        {success && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#e1fef4', color: '#27ae60', borderRadius: '15px', textAlign: 'center', fontWeight: '700', border: '1px solid #c3f9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} />
              AI knowledge base updated successfully!
            </div>
            {crawlStats && (
              <div style={{ fontSize: '0.85rem', fontWeight: '400' }}>
                Processed <strong>{crawlStats.count}</strong> pages related to the link.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(75, 36, 139, 0.03)', padding: '2.5rem', borderRadius: '30px', border: '1px dashed rgba(75, 36, 139, 0.2)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#4b248b' }}>
          <Sparkles size={22} /> Suggested Training
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#636e72', marginBottom: '2rem', lineHeight: '1.6' }}>For best performance, ingest these key Vignan University pages first:</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {universityLinks.map((link, idx) => (
            <div 
              key={idx} 
              onClick={() => { setUrl(link.url); setName(link.name); }}
              style={{ background: 'white', padding: '1.25rem', borderRadius: '15px', cursor: 'pointer', border: '1px solid #eee', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateX(5px)'; e.currentTarget.style.borderColor = '#4b248b'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = '#eee'; }}
            >
              <Layout size={18} color="#4b248b" />
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#2d3436' }}>{link.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#b2bec3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{link.url}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddLink;
