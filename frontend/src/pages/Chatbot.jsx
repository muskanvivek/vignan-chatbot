import React, { useState, useRef, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import MessageBubble from '../components/MessageBubble';
import VoiceInput from '../components/VoiceInput';
import VoiceOutput from '../components/VoiceOutput';
import { Send, Globe, Loader2, Sparkles } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
];

const Chatbot = () => {
  console.log('Chatbot Rendering...');
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hello! I'm your Vignan University Student Support Assistant. How can I help you today?", data: null }
  ]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechText, setSpeechText] = useState('');
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    console.log('Chatbot mounted');
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text) => {
    const messageToSend = text || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = { role: 'user', text: messageToSend };
    
    // Get current history BEFORE updating state with the new user message
    const currentHistory = messages.map(m => ({ role: m.role, text: m.text }));
    
    // Update UI with user message
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send the history including the current message context
      const response = await api.chat(messageToSend, language, currentHistory);
      const botMessage = { 
        role: 'bot', 
        text: response.data.detailed_answer,
        data: response.data 
      };
      setMessages(prev => [...prev, botMessage]);
      
      setSpeechText(botMessage.text);
      // Auto-play is fine, but ensure it doesn't crash
      try {
        setIsPlaying(true);
      } catch (e) {
        console.warn('Speech playback blocked by browser');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorDetail = error.response?.data?.error || error.message;
      const errorMessage = { 
        role: 'bot', 
        text: `I'm sorry, I'm having trouble connecting to my brain right now. (Error: ${errorDetail})`,
        data: null 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      
      <main className="chatbot-main">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <MessageBubble 
              key={idx} 
              message={msg} 
              onSpeak={(text) => {
                setSpeechText(text);
                setIsPlaying(true);
              }} 
            />
          ))}
          {isLoading && (
            <div className="message-row bot">
              <div className="message-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 className="animate-spin" size={16} color="#4b248b" />
                <span style={{ fontSize: '0.9rem', color: '#636e72' }}>Processing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="input-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} color="#4b248b" />
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="lang-selector"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <VoiceOutput 
                text={speechText} 
                language={language} 
                isPlaying={isPlaying} 
                onToggle={setIsPlaying} 
              />
              <VoiceInput 
                language={language} 
                onSpeechEnd={handleSend} 
              />
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="input-form"
          >
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about admissions, fees, or campus..."
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="send-btn"
            >
              <Send size={20} />
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.7rem', color: '#b2bec3' }}>
            <Sparkles size={10} style={{ marginRight: '4px' }} />
            Powered by Vignan AI Assistant
          </div>
        </div>
      </main>
    </div>
  );
};

export default Chatbot;
