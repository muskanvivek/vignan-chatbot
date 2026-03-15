import React, { useState } from 'react';
import api from '../api/api';
import { HelpCircle, CheckCircle, Loader2, Sparkles, MessageSquareQuote, Folder } from 'lucide-react';

const AddFAQ = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [folder, setFolder] = useState('/');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question || !answer) return;

    setLoading(true);
    setSuccess(false);

    try {
      await api.ingestFAQ(question, answer, folder.trim() || '/');
      setSuccess(true);
      setQuestion('');
      setAnswer('');
      setFolder('/');
    } catch (error) {
      console.error('FAQ ingestion failed:', error);
      alert('FAQ ingestion failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', color: '#2d3436' }}>Expert Knowledge Entry</h2>
        <p style={{ color: '#636e72', marginBottom: '2.5rem', fontSize: '1rem' }}>Manually add common questions and their definitive answers. These are treated as <strong>Highest Priority</strong> by the AI.</p>

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
            <label style={{ color: '#2d3436', fontWeight: '700' }}>The Question</label>
            <input 
              type="text" 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., How do I apply for a scholarship?"
              className="form-control"
              style={{ height: '55px', background: '#f8f9fa' }}
              required
            />
          </div>

          <div className="form-group">
            <label style={{ color: '#2d3436', fontWeight: '700' }}>The Definitive Answer</label>
            <textarea 
              rows="6"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a detailed and helpful response with Markdown if needed..."
              className="form-control"
              style={{ background: '#f8f9fa', resize: 'none', padding: '1rem' }}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={!question || !answer || loading}
            className="btn-primary"
            style={{ height: '55px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            {loading ? 'Training AI...' : 'Save to Knowledge Base'}
          </button>
        </form>

        {success && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#e1fef4', color: '#27ae60', borderRadius: '15px', textAlign: 'center', fontWeight: '700', border: '1px solid #c3f9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            Expert FAQ added successfully!
          </div>
        )}
      </div>

      <div style={{ background: 'rgba(75, 36, 139, 0.03)', padding: '2.5rem', borderRadius: '30px', border: '1px dashed rgba(75, 36, 139, 0.2)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#4b248b' }}>
          <MessageSquareQuote size={22} /> Why use FAQs?
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#2d3436', fontSize: '0.9rem', marginBottom: '0.25rem' }}>100% Accuracy</div>
            <p style={{ fontSize: '0.85rem', color: '#636e72', lineHeight: '1.5' }}>FAQs provide direct answers that bypass document parsing errors.</p>
          </div>
          <div>
            <div style={{ fontWeight: '700', color: '#2d3436', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Priority Retrieval</div>
            <p style={{ fontSize: '0.85rem', color: '#636e72', lineHeight: '1.5' }}>The AI is trained to check FAQs first before looking at long PDFs or web pages.</p>
          </div>
          <div>
            <div style={{ fontWeight: '700', color: '#2d3436', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Rich Formatting</div>
            <p style={{ fontSize: '0.85rem', color: '#636e72', lineHeight: '1.5' }}>You can use Markdown tables and lists in your FAQ answers for better readability.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFAQ;
