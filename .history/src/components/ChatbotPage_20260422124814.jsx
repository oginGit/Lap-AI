/**
 * ChatbotPage — Modern AI Troubleshooting Assistant
 * Clean, professional interface inspired by ChatGPT/modern AI chat apps.
 * Features:
 * - Clean welcome screen with suggestion chips
 * - Right-side chat history panel (toggled by icon)
 * - File/image upload, voice input
 * - Edit messages, regenerate responses
 * - Multilingual backend (English, Urdu, Roman Urdu) — auto-detected, no toggle
 * - Backend uses Mistral-7B locally (if GPU available) or Groq API fallback
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, Send, Loader, Plus, Trash2, MessageSquare,
  Paperclip, Mic, MicOff, X, Edit3, RefreshCw,
  Sparkles, Clock, ChevronRight, Zap, Battery, Wifi,
} from 'lucide-react';

// ── AI API call (Backend → Mistral/Groq) ─────────────────────────────────────
async function callAI(messages) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  // Try backend endpoint first (uses local Mistral-7B or Groq fallback)
  try {
    const backendResponse = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        apiKey: apiKey,
      }),
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      if (data.response) return data.response;
      if (data.error) throw new Error(data.error);
    }
  } catch (backendErr) {
    console.log('Backend chatbot unavailable, trying Groq directly...', backendErr.message);
  }

  // Direct Groq API fallback (if backend is down)
  if (!apiKey) {
    throw new Error('AI service unavailable. Start the Python backend or add VITE_GROQ_API_KEY to .env');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system', content: `You are a smart laptop troubleshooting assistant.

STRICT RULE:
You only answer questions related to laptops. If a user asks anything outside laptop topics, reply exactly:
"Kindly ask a question related to laptop issues."

LANGUAGE UNDERSTANDING:
You understand English, Urdu, and Roman Urdu. Handle spelling mistakes and incomplete sentences.

RESPONSE STYLE:
- Simple question → short direct answer.
- Complex issue → step-by-step troubleshooting with format:
  **🔍 What's happening:** Brief explanation.
  **⚡ Possible causes:** Bullet list.
  **🛠️ How to fix it:** Numbered steps.
  **💡 Prevention tip:** One sentence.

COVERAGE: performance, battery, boot errors, drivers, hardware, overheating, WiFi, maintenance.
Match the user's language (English/Urdu/Roman Urdu). Be friendly and practical.` },
        ...messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
}

// ── Formatted message renderer ───────────────────────────────────────────────
const FormattedMessage = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="cb-msg-text">
      {lines.map((line, i) => {
        // Bold headers with emoji
        const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
          return (
            <div key={i} className="cb-msg-heading">
              <strong>{boldMatch[1]}</strong>
              {boldMatch[2] && <span>{boldMatch[2]}</span>}
            </div>
          );
        }
        // Inline bold
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <div key={i} style={{ marginBottom: 2 }}>
              {parts.map((part, j) =>
                j % 2 === 1 ? <strong key={j} className="cb-inline-bold">{part}</strong> : part
              )}
            </div>
          );
        }
        // Bullet points
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="cb-msg-bullet">
              <span className="cb-bullet-dot">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        // Numbered steps
        const numMatch = line.match(/^(\d+)\.\s(.+)$/);
        if (numMatch) {
          return (
            <div key={i} className="cb-msg-step">
              <span className="cb-step-num">{numMatch[1]}</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginBottom: 2 }}>{line}</div>;
      })}
    </div>
  );
};

// ── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { text: 'Why is my laptop slow?', icon: '🐢' },
  { text: 'How to fix overheating issue?', icon: '🌡️' },
  { text: 'Battery draining fast solution', icon: '🔋' },
  { text: 'WiFi not connecting fix', icon: '🌐' },
  { text: 'No boot device found solution', icon: '🖥️' },
  { text: 'Laptop stuck on startup', icon: '⏳' },
  { text: 'Fan noise problem', icon: '🔊' },
  { text: 'How to clean storage space?', icon: '💾' },
];

// ── Quick feature cards for welcome screen ───────────────────────────────────
const FEATURE_CARDS = [
  {
    icon: <Zap size={22} />,
    title: 'Performance Issues',
    desc: 'Slow speed, high CPU, lag fixes',
    query: 'My laptop is running very slow, how can I fix it?',
    gradient: 'perf',
  },
  {
    icon: <Battery size={22} />,
    title: 'Battery Problems',
    desc: 'Drain, charging, health tips',
    query: 'My laptop battery is draining very fast, what should I do?',
    gradient: 'battery',
  },
  {
    icon: <Wifi size={22} />,
    title: 'Connectivity Issues',
    desc: 'WiFi, Bluetooth, network fixes',
    query: 'My WiFi keeps disconnecting, how to fix it?',
    gradient: 'connect',
  },
];

// ── LocalStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'laptopmd_chat_history';

function loadChatHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChatHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) { console.warn('Save failed:', e); }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Main Component ───────────────────────────────────────────────────────────
const ChatbotPage = ({ toast }) => {
  const [chatHistory, setChatHistory] = useState(() => loadChatHistory());
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Persist
  useEffect(() => { saveChatHistory(chatHistory); }, [chatHistory]);

  // Load active chat
  useEffect(() => {
    if (activeChatId) {
      const chat = chatHistory.find(c => c.id === activeChatId);
      if (chat) setMessages(chat.messages);
    }
  }, [activeChatId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus
  useEffect(() => { inputRef.current?.focus(); }, [activeChatId]);

  // Save current chat
  const saveCurrentChat = useCallback((msgs, chatId = activeChatId) => {
    if (!chatId) return;
    setChatHistory(prev => {
      const idx = prev.findIndex(c => c.id === chatId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const firstUserMsg = msgs.find(m => m.role === 'user');
      updated[idx] = {
        ...updated[idx],
        messages: msgs,
        title: firstUserMsg
          ? firstUserMsg.content.slice(0, 45) + (firstUserMsg.content.length > 45 ? '...' : '')
          : updated[idx].title,
        updatedAt: Date.now(),
      };
      return updated;
    });
  }, [activeChatId]);

  // Create new chat
  const createNewChat = () => {
    const newChat = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChatHistory(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
    setInput('');
    setAttachments([]);
    setEditingIdx(null);
  };

  // Delete single
  const deleteChat = (id, e) => {
    e?.stopPropagation();
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
    toast?.info('Chat deleted');
  };

  // Delete all
  const deleteAllChats = () => {
    setChatHistory([]);
    setActiveChatId(null);
    setMessages([]);
    setShowDeleteAll(false);
    toast?.info('All chats deleted');
  };

  // Send message
  const sendMessage = async (overrideText = null) => {
    const text = overrideText || input.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading) return;

    let content = text;
    if (attachments.length > 0) {
      const fileNames = attachments.map(a => a.name).join(', ');
      content = `${text}\n\n[Attached: ${fileNames}]`;
    }

    const userMsg = { role: 'user', content };
    let chatId = activeChatId;

    if (!chatId) {
      const newChat = {
        id: generateId(),
        title: content.slice(0, 45) + (content.length > 45 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      chatId = newChat.id;
      setChatHistory(prev => [newChat, ...prev]);
      setActiveChatId(chatId);
    }

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const reply = await callAI(updatedMessages);
      const newMsgs = [...updatedMessages, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs, chatId);
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nPlease check your API key in the .env file.`,
      };
      const newMsgs = [...updatedMessages, errMsg];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs, chatId);
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate
  const regenerateResponse = async (idx) => {
    if (isLoading) return;
    const msgsBeforeBot = messages.slice(0, idx);
    setMessages(msgsBeforeBot);
    setIsLoading(true);
    try {
      const reply = await callAI(msgsBeforeBot);
      const newMsgs = [...msgsBeforeBot, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs);
    } catch (err) {
      const errMsg = { role: 'assistant', content: `⚠️ **Error:** ${err.message}` };
      setMessages([...msgsBeforeBot, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Edit
  const submitEdit = async (idx) => {
    if (!editText.trim() || isLoading) return;
    const msgsBeforeEdit = messages.slice(0, idx);
    const editedMsg = { role: 'user', content: editText.trim() };
    const updatedMsgs = [...msgsBeforeEdit, editedMsg];
    setMessages(updatedMsgs);
    setEditingIdx(null);
    setEditText('');
    setIsLoading(true);
    try {
      const reply = await callAI(updatedMsgs);
      const newMsgs = [...updatedMsgs, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs);
    } catch (err) {
      const errMsg = { role: 'assistant', content: `⚠️ **Error:** ${err.message}` };
      setMessages([...updatedMsgs, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice
  const toggleVoice = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast?.error('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => { setIsRecording(false); toast?.error('Voice input failed.'); };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // File upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newAtts = files.map(f => ({
      name: f.name, size: f.size, type: f.type,
      isImage: f.type.startsWith('image/'),
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => {
      const updated = [...prev];
      if (updated[idx]?.preview) URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isWelcomeScreen = messages.length === 0;

  return (
    <div className="cb-page fade-in">
      {/* ── Main Chat Area ── */}
      <div className="cb-main">
        <div className="cb-chat-card">
          {/* Header */}
          <div className="cb-header">
            <div className="cb-header-left">
              <div className="cb-header-avatar">
                <Bot size={20} />
              </div>
              <div className="cb-header-info">
                <h2>LapGuard AI</h2>
                <span className="cb-header-status">
                  <span className="cb-dot-online" />
                  {isLoading ? 'Thinking…' : 'Online'}
                </span>
              </div>
            </div>
            <div className="cb-header-actions">
              <button
                className="cb-icon-btn"
                onClick={createNewChat}
                title="New chat"
                id="new-chat-header-btn"
              >
                <Plus size={16} />
              </button>
              <button
                className={`cb-icon-btn ${historyOpen ? 'active' : ''}`}
                onClick={() => setHistoryOpen(!historyOpen)}
                title="Chat history"
                id="toggle-history-btn"
              >
                <Clock size={16} />
                {chatHistory.length > 0 && (
                  <span className="cb-badge-count">{chatHistory.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* Messages or Welcome */}
          <div className="cb-messages-area">
            {isWelcomeScreen ? (
              /* ── Welcome Screen ── */
              <div className="cb-welcome">
                <div className="cb-welcome-glow" />
                <div className="cb-welcome-icon">
                  <Bot size={30} />
                </div>
                <h2>Welcome to LapGuard AI Chatbot</h2>
                <p>How can I assist you today?</p>

                {/* Feature cards */}
                <div className="cb-feature-cards">
                  {FEATURE_CARDS.map((card, i) => (
                    <button
                      key={i}
                      className={`cb-feature-card ${card.gradient}`}
                      onClick={() => sendMessage(card.query)}
                      id={`feature-card-${i}`}
                    >
                      <div className="cb-feature-icon-wrap">{card.icon}</div>
                      <span className="cb-feature-title">{card.title}</span>
                      <span className="cb-feature-desc">{card.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Suggestion chips */}
                <div className="cb-suggestions">
                  <span className="cb-suggestions-label">
                    <Sparkles size={12} /> Try asking:
                  </span>
                  <div className="cb-chips">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        className="cb-chip"
                        onClick={() => sendMessage(s.text)}
                        id={`suggestion-chip-${i}`}
                      >
                        <span>{s.icon}</span> {s.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Chat Messages ── */
              <div className="cb-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`cb-bubble-row ${msg.role === 'user' ? 'user' : 'bot'}`}
                  >
                    <div className={`cb-avatar ${msg.role === 'user' ? 'user-av' : 'bot-av'}`}>
                      {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                    </div>

                    <div className="cb-bubble-content">
                      {editingIdx === i ? (
                        <div className="cb-edit-box">
                          <textarea
                            className="cb-edit-input"
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div className="cb-edit-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => submitEdit(i)}>
                              <Send size={12} /> Save & Send
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingIdx(null); setEditText(''); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`cb-bubble ${msg.role === 'user' ? 'user-bbl' : 'bot-bbl'}`}>
                          <FormattedMessage text={msg.content} />
                        </div>
                      )}

                      {editingIdx !== i && i > 0 && (
                        <div className="cb-msg-actions">
                          {msg.role === 'user' && (
                            <button
                              className="cb-action-btn"
                              onClick={() => { setEditingIdx(i); setEditText(msg.content); }}
                            >
                              <Edit3 size={11} /> Edit
                            </button>
                          )}
                          {msg.role === 'assistant' && (
                            <button
                              className="cb-action-btn"
                              onClick={() => regenerateResponse(i)}
                              disabled={isLoading}
                            >
                              <RefreshCw size={11} /> Regenerate
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="cb-bubble-row bot">
                    <div className="cb-avatar bot-av"><Bot size={15} /></div>
                    <div className="cb-bubble-content">
                      <div className="cb-bubble bot-bbl cb-typing">
                        <div className="cb-typing-dots"><span /><span /><span /></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Suggestion chips when in conversation */}
          {!isWelcomeScreen && messages.length <= 2 && !isLoading && (
            <div className="cb-inline-suggestions">
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} className="cb-chip-sm" onClick={() => sendMessage(s.text)}>
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="cb-attachments">
              {attachments.map((att, i) => (
                <div key={i} className="cb-att-item">
                  {att.isImage ? (
                    <img src={att.preview} alt={att.name} className="cb-att-img" />
                  ) : (
                    <div className="cb-att-file"><Paperclip size={12} /></div>
                  )}
                  <span className="cb-att-name">{att.name}</span>
                  <button className="cb-att-remove" onClick={() => removeAttachment(i)}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="cb-input-bar">
            <div className="cb-input-row">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.log,.doc,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button className="cb-in-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                <Paperclip size={16} />
              </button>
              <button
                className={`cb-in-btn ${isRecording ? 'recording' : ''}`}
                onClick={toggleVoice}
                title={isRecording ? 'Stop' : 'Voice input'}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <textarea
                ref={inputRef}
                className="cb-input"
                placeholder="Ask about laptop issues only…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
                id="chatbot-main-input"
              />

              <button
                className={`cb-send ${(!input.trim() && !attachments.length) || isLoading ? 'disabled' : ''}`}
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !attachments.length) || isLoading}
                id="chatbot-send-btn"
              >
                {isLoading ? <Loader size={16} className="spin-anim" /> : <Send size={16} />}
              </button>
            </div>
            <div className="cb-footer-note">
              <Sparkles size={10} /> Powered by Groq AI — LaptopGuard Health Monitor
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Chat History ── */}
      <aside className={`cb-history ${historyOpen ? 'open' : ''}`}>
        <div className="cb-history-header">
          <h3><Clock size={14} /> Chat History</h3>
          <button className="cb-icon-btn" onClick={() => setHistoryOpen(false)}>
            <ChevronRight size={16} />
          </button>
        </div>

        <button className="cb-new-chat" onClick={() => { createNewChat(); }} id="new-chat-btn">
          <Plus size={14} /> New Chat
        </button>

        <div className="cb-history-list">
          {chatHistory.length === 0 ? (
            <div className="cb-history-empty">
              <MessageSquare size={24} />
              <p>No conversations yet</p>
              <span>Start a new chat to begin!</span>
            </div>
          ) : (
            chatHistory.map(chat => (
              <div
                key={chat.id}
                className={`cb-history-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setMessages(chat.messages);
                  setEditingIdx(null);
                }}
              >
                <div className="cb-history-item-info">
                  <MessageSquare size={13} />
                  <div>
                    <span className="cb-history-title">{chat.title}</span>
                    <span className="cb-history-date">
                      {timeAgo(chat.updatedAt)}
                    </span>
                  </div>
                </div>
                <button className="cb-history-del" onClick={(e) => deleteChat(chat.id, e)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {chatHistory.length > 0 && (
          <div className="cb-history-footer">
            {showDeleteAll ? (
              <div className="cb-del-confirm">
                <span>Delete all chats?</span>
                <div className="cb-del-btns">
                  <button className="cb-del-yes" onClick={deleteAllChats}>Delete all</button>
                  <button className="cb-del-no" onClick={() => setShowDeleteAll(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="cb-del-all" onClick={() => setShowDeleteAll(true)} id="delete-all-chats-btn">
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>
        )}
      </aside>

      {/* History overlay backdrop for mobile */}
      {historyOpen && (
        <div
          className="cb-history-backdrop"
          onClick={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatbotPage;
