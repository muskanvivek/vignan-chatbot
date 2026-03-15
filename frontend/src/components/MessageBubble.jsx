import React from 'react';
import { User, Bot, Volume2, Phone, Mail, FileText, Heart, ShieldAlert, Smile, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MessageBubble = ({ message, onSpeak }) => {
  const isBot = message.role === 'bot';
  const sentiment = message.data?.sentiment?.toLowerCase() || '';

  const getSentimentIcon = () => {
    if (sentiment.includes('stressed') || sentiment.includes('anxious') || sentiment.includes('sad')) 
      return <Heart size={14} color="#e74c3c" fill="#e74c3c" />;
    if (sentiment.includes('happy') || sentiment.includes('satisfied') || sentiment.includes('curious')) 
      return <Smile size={14} color="#27ae60" />;
    return null;
  };

  const getSocialLinks = () => {
    return (
      <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
        <a href="https://facebook.com/VignanUniversity" target="_blank" rel="noreferrer"><Facebook size={16} color="#1877F2" /></a>
        <a href="https://instagram.com/VignanUniversity" target="_blank" rel="noreferrer"><Instagram size={16} color="#E4405F" /></a>
        <a href="https://twitter.com/VignanUniversity" target="_blank" rel="noreferrer"><Twitter size={16} color="#1DA1F2" /></a>
        <a href="https://linkedin.com/school/vignan-university" target="_blank" rel="noreferrer"><Linkedin size={16} color="#0A66C2" /></a>
      </div>
    );
  };
  
  return (
    <div className={`message-row ${isBot ? 'bot' : 'user'}`}>
      <div className="message-content">
        <div className="message-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isBot ? 'Vignan AI Assistant' : 'Student'}
          {isBot && getSentimentIcon()}
        </div>
        <div className="message-text">
          {isBot ? (
            <div className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={{
                  table: ({node, ...props}) => <div style={{ overflowX: 'auto' }}><table {...props} /></div>
                }}
              >
                {message.text || "_I'm sorry, I encountered an error while processing your request._"}
              </ReactMarkdown>
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
          )}
        </div>
        
        {isBot && message.data && (
          <div className="bot-extra-content" style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
            {message.data.important_contacts?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#636e72', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Related Contacts:</div>
                {message.data.important_contacts.map((contact, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', color: '#4b248b', fontWeight: '600', marginBottom: '0.25rem' }}>{contact}</div>
                ))}
              </div>
            )}
            
            {message.data.sources?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {message.data.sources.map((source, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', background: 'rgba(75, 36, 139, 0.1)', borderRadius: '10px', color: '#4b248b' }}>
                    <FileText size={10} style={{ marginRight: '4px' }} />
                    {source}
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #eee', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#b2bec3', marginBottom: '0.25rem' }}>Stay Connected:</div>
              {getSocialLinks()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => onSpeak(message.data.short_answer || message.text)}
                className="voice-btn voice-output-btn"
                title="Listen to response"
                style={{ width: '32px', height: '32px' }}
              >
                <Volume2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
