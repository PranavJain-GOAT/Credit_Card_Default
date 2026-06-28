import { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api';

function formatMarkdown(text) {
  if (!text) return '';
  let escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  let lines = formatted.split('\n');
  let result = [];
  let inList = false;
  for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      let itemContent = trimmed.substring(2).trim();
      if (!inList) { result.push('<ul style="margin-left:20px;margin-top:6px;margin-bottom:6px;padding-left:0;list-style-type:disc;">'); inList = true; }
      result.push(`<li style="margin-bottom:4px;">${itemContent}</li>`);
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      if (trimmed !== '') result.push(`<p style="margin-bottom:8px;">${line}</p>`);
      else result.push('<div style="height:6px;"></div>');
    }
  }
  if (inList) result.push('</ul>');
  return result.join('');
}

export default function ChatBot({ results, applicant }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', html: formatMarkdown('Hello! I\'m your **AI Underwriting Assistant**. Ask me anything about the active credit case or general credit risk questions.') }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showBubble, setShowBubble] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const toggleChat = () => {
    setIsOpen(o => !o);
    setShowBubble(false);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const text = inputVal.trim();
    if (!text || isThinking) return;
    setInputVal('');
    setMessages(prev => [...prev, { sender: 'user', html: formatMarkdown(text) }]);
    setIsThinking(true);
    const key = localStorage.getItem('gemini_api_key') || '';
    const caseLoaded = results !== null;
    const applicantData = applicant || { name: 'Applicant' };
    const predictionData = results || { decision: 'PENDING', default_probability: 0.0, risk_category: 'Unknown', recommendations: [], scores: { credit_to_income: 0.0, annuity_to_income: 0.0 } };
    try {
      const data = await sendChat(text, applicantData, predictionData, caseLoaded, key);
      setMessages(prev => [...prev, { sender: 'bot', html: formatMarkdown(data.reply || 'No response received.') }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', html: '<span style="color:var(--danger)">Error: Failed to connect to underwriting assistant.</span>' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  const saveApiKey = () => {
    const key = apiKeyInput.trim();
    if (key) { localStorage.setItem('gemini_api_key', key); alert('Gemini API key saved!'); }
    else { localStorage.removeItem('gemini_api_key'); alert('API key cleared.'); }
    setShowSettings(false);
  };

  const clearApiKey = () => {
    setApiKeyInput('');
    localStorage.removeItem('gemini_api_key');
    alert('Gemini API key cleared.');
    setShowSettings(false);
  };

  return (
    <div className="chat-widget-container">
      {showBubble && (
        <div id="chat-speech-bubble" className="chat-speech-bubble" onClick={toggleChat}>
          <span>💬 Ask AI about this case</span>
          <button className="speech-bubble-close" onClick={(e) => { e.stopPropagation(); setShowBubble(false); }}>✕</button>
        </div>
      )}

      {isOpen && (
        <div id="chat-window" className="chat-window active">
          <div className="chat-header">
            <div className="chat-header-title">
              <div style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>AI</div>
              <div>
                <div>Underwriting Assistant</div>
                <div style={{ fontSize: '10px', opacity: 0.75 }}>Powered by Gemini</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="chat-header-btn" onClick={() => { setShowSettings(s => !s); setApiKeyInput(localStorage.getItem('gemini_api_key') || ''); }} title="API Settings" style={{ color: 'white' }}>⚙</button>
              <button className="chat-header-btn" onClick={() => setIsOpen(false)} title="Close" style={{ color: 'white' }}>✕</button>
            </div>
          </div>

          {showSettings && (
            <div id="chat-settings-panel" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Gemini API Key</label>
              <input
                id="chat-api-key-input"
                type="password"
                placeholder="AIza..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                style={{ height: '32px', padding: '0 10px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'IBM Plex Sans, sans-serif' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={saveApiKey}>Save Key</button>
                <button className="btn btn-secondary btn-sm" onClick={clearApiKey}>Clear</button>
              </div>
            </div>
          )}

          <div id="chat-messages" className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.sender}`} dangerouslySetInnerHTML={{ __html: msg.html }} />
            ))}
            {isThinking && (
              <div className="chat-message bot" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                AI is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              id="chat-input"
              type="text"
              className="chat-input"
              placeholder="Ask about this credit case..."
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={isThinking}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <button className="chat-toggle-btn" onClick={toggleChat} title="AI Underwriting Assistant">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
}
