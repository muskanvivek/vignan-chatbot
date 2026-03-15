import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { 
  Trash2, 
  Edit3,
  FileText, 
  Globe, 
  HelpCircle, 
  Contact as ContactIcon, 
  CheckCircle, 
  Loader2,
  Database,
  Search,
  Folder,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  X,
  Save,
  RefreshCw
} from 'lucide-react';

const ManageSources = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(['/']);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const response = await api.getSources();
      setSources(response.data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this source and all its knowledge base chunks?')) return;
    
    try {
      await api.deleteSource(id);
      setSources(sources.filter(s => s._id !== id));
    } catch (error) {
      console.error('Failed to delete source:', error);
      alert('Delete failed: ' + error.message);
    }
  };

  const handleEdit = (source) => {
    setEditingId(source._id);
    setEditData({ ...source });
  };

  const handleSaveEdit = async () => {
    try {
      await api.updateSource(editingId, editData);
      setEditingId(null);
      fetchSources();
    } catch (error) {
      console.error('Update failed:', error);
      alert('Update failed: ' + error.message);
    }
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => 
      prev.includes(folderPath) ? prev.filter(f => f !== folderPath) : [...prev, folderPath]
    );
  };

  const filteredSources = sources.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.folder && s.folder.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group by folder with aggressive normalization
  const sourcesByFolder = filteredSources.reduce((acc, source) => {
    // Normalize: Trim, remove leading slash, and use lowercase for comparison
    let folder = (source.folder || '').trim();
    
    // Ensure consistent root handling
    if (folder === '' || folder === '/') {
      folder = '/';
    } else {
      // Remove leading slash if it exists (e.g. '/links' -> 'links')
      if (folder.startsWith('/')) folder = folder.substring(1);
      // Remove trailing slash if it exists (e.g. 'links/' -> 'links')
      if (folder.endsWith('/')) folder = folder.slice(0, -1);
      // Use lowercase for grouping to avoid 'Links' vs 'links'
      folder = folder.toLowerCase();
    }
    
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(source);
    return acc;
  }, {});

  const sortedFolders = Object.keys(sourcesByFolder).sort();

  const getIcon = (type) => {
    switch (type) {
      case 'pdf': return <FileText size={18} color="#e74c3c" />;
      case 'url': return <Globe size={18} color="#3498db" />;
      case 'faq': return <HelpCircle size={18} color="#9b59b6" />;
      case 'contact': return <ContactIcon size={18} color="#27ae60" />;
      default: return <FileText size={18} color="#95a5a6" />;
    }
  };

  const handleRefreshUrl = async (source) => {
    setLoading(true);
    try {
      await api.updateSource(source._id, { refreshUrl: true });
      alert('Content updated successfully from the live URL!');
      fetchSources();
    } catch (error) {
      console.error('Refresh failed:', error);
      alert('Failed to update content from URL: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const FolderSection = ({ folderPath, items }) => {
    const isExpanded = expandedFolders.includes(folderPath) || searchQuery;
    
    // Display name for the folder (capitalize first letter for better UI)
    const displayName = folderPath === '/' 
      ? 'Root Directory' 
      : folderPath.charAt(0).toUpperCase() + folderPath.slice(1);
    
    return (
      <div className="folder-container" style={{ marginBottom: '2rem' }}>
        <div className="folder-header-row" onClick={() => toggleFolder(folderPath)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 0' }}>
          {isExpanded ? <ChevronDown size={20} color="#b2bec3" /> : <ChevronRight size={20} color="#b2bec3" />}
          <Folder size={24} color="#fbc02d" fill="#fbc02d" />
          <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3436' }}>
            {displayName} ({items.length})
          </span>
        </div>
        
        {isExpanded && (
          <div className="cards-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', 
            gap: '1.5rem', 
            padding: '1rem 0 1rem 32px' 
          }}>
            {items.map((source) => (
              <div key={source._id} className="source-card" style={{ 
                background: 'white', 
                borderRadius: '20px', 
                padding: '1.5rem', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                border: '1px solid #f1f2f6',
                position: 'relative',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ 
                    background: source.type === 'faq' ? '#6c5ce7' : source.type === 'pdf' ? '#ff7675' : '#74b9ff', 
                    color: 'white', 
                    padding: '4px 12px', 
                    borderRadius: '8px', 
                    fontSize: '0.75rem', 
                    fontWeight: '700',
                    textTransform: 'capitalize'
                  }}>
                    {source.type}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {source.type === 'url' && editingId !== source._id && (
                      <button 
                        onClick={() => handleRefreshUrl(source)}
                        style={{ 
                          background: '#e8f5e9', 
                          border: 'none', 
                          padding: '6px 12px', 
                          borderRadius: '8px', 
                          color: '#2e7d32', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                        title="Update information from live URL"
                      >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Sync
                      </button>
                    )}
                    <button 
                      onClick={() => editingId === source._id ? handleSaveEdit() : handleEdit(source)}
                      style={{ 
                        background: '#e3f2fd', 
                        border: 'none', 
                        padding: '6px 12px', 
                        borderRadius: '8px', 
                        color: '#2196f3', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      {editingId === source._id ? <Save size={14} /> : <Edit3 size={14} />}
                      {editingId === source._id ? 'Save' : 'Edit'}
                    </button>
                    <button 
                      onClick={() => editingId === source._id ? setEditingId(null) : handleDelete(source._id)}
                      style={{ 
                        background: '#ffebee', 
                        border: 'none', 
                        padding: '6px 12px', 
                        borderRadius: '8px', 
                        color: '#f44336', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      {editingId === source._id ? <X size={14} /> : <Trash2 size={14} />}
                      {editingId === source._id ? 'Cancel' : 'Delete'}
                    </button>
                  </div>
                </div>

                {editingId === source._id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input 
                      type="text" 
                      value={editData.name} 
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="form-control"
                      style={{ fontSize: '0.9rem', padding: '8px' }}
                      placeholder="Name/Question"
                    />
                    {source.type === 'faq' && (
                      <textarea 
                        value={editData.answer} 
                        onChange={(e) => setEditData({ ...editData, answer: e.target.value })}
                        className="form-control"
                        style={{ fontSize: '0.85rem', padding: '8px', minHeight: '80px' }}
                        placeholder="Answer"
                      />
                    )}
                    {source.type === 'contact' && (
                      <>
                        <input 
                          type="text" 
                          value={editData.phone} 
                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                          className="form-control"
                          style={{ fontSize: '0.85rem', padding: '8px' }}
                          placeholder="Phone"
                        />
                        <input 
                          type="email" 
                          value={editData.email} 
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className="form-control"
                          style={{ fontSize: '0.85rem', padding: '8px' }}
                          placeholder="Email"
                        />
                      </>
                    )}
                    <input 
                      type="text" 
                      value={editData.folder} 
                      onChange={(e) => setEditData({ ...editData, folder: e.target.value })}
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '8px' }}
                      placeholder="Folder path (e.g., /admissions)"
                    />
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: '700', color: '#2d3436', fontSize: '1rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                      {source.type === 'faq' ? `Q: ${source.name}` : source.name}
                    </div>
                    {source.type === 'faq' && (
                      <div style={{ 
                        background: '#f8f9fa', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        fontSize: '0.85rem', 
                        color: '#636e72',
                        borderLeft: '4px solid #6c5ce7',
                        marginBottom: '1rem'
                      }}>
                        <strong>A:</strong> {source.answer || 'Detailed answer stored in chunks...'}
                      </div>
                    )}
                    {source.type === 'contact' && (
                      <div style={{ 
                        background: '#f8f9fa', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        fontSize: '0.85rem', 
                        color: '#636e72',
                        borderLeft: '4px solid #27ae60',
                        marginBottom: '1rem'
                      }}>
                        <div><strong>Phone:</strong> {source.phone}</div>
                        <div><strong>Email:</strong> {source.email}</div>
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#b2bec3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Added: {new Date(source.createdAt).toLocaleString()}</span>
                      <span style={{ 
                        color: source.status === 'processed' ? '#27ae60' : '#f1c40f',
                        fontWeight: '800'
                      }}>
                        ● {source.status.toUpperCase()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="manage-sources">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: '#2d3436', fontWeight: '800', letterSpacing: '-0.5px' }}>University Knowledge Base</h2>
          <p style={{ color: '#636e72', fontSize: '1rem', marginTop: '0.5rem' }}>Organized file-wise and folder-wise management of AI data.</p>
        </div>
        <button onClick={fetchSources} className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
          Refresh
        </button>
      </div>

      <div className="search-bar-container">
        <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#b2bec3' }} />
        <input 
          type="text" 
          placeholder="Search all files, folders, or types..." 
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sortedFolders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.5)', borderRadius: '30px', border: '2px dashed #eee' }}>
            <Database size={48} color="#b2bec3" style={{ marginBottom: '1rem' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#2d3436' }}>Knowledge Base is Empty</div>
            <p style={{ color: '#636e72' }}>Start by adding PDFs, Links, or FAQs from the sidebar.</p>
          </div>
        ) : (
          sortedFolders.map(folder => (
            <FolderSection key={folder} folderPath={folder} items={sourcesByFolder[folder]} />
          ))
        )}
      </div>
    </div>
  );
};

export default ManageSources;
