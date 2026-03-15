import React from 'react';
import { User, Bot, Volume2, Phone, Mail, FileText } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MessageBubble = ({ message, onSpeak }) => {
  const isBot = message.role === 'bot';
  
  return (
    <div className={`message-row ${isBot ? 'bot' : 'user'}`}>
      <div className="message-content">
        <div className="message-header">
          {isBot ? 'Vignan AI Assistant' : 'Student'}
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

            <button 
              onClick={() => onSpeak(message.text)}
              className="voice-btn voice-output-btn"
              title="Listen to response"
              style={{ width: '32px', height: '32px' }}
            >
              <Volume2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
