import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, Send, Loader, Plus, Trash2, MessageSquare,
  Paperclip, X, Edit3, RefreshCw,
  Clock, ChevronRight, Copy, Check, Image as ImageIcon,
  Shield, Sparkles, Mic, Square,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

let baseAiApi = import.meta.env.VITE_AI_API_URL || import.meta.env.VITE_AUTH_API_URL || '/api/ai';
if (baseAiApi.startsWith('http')) {
  try {
    const origin = new URL(baseAiApi).origin;
    baseAiApi = `${origin}/api/ai`;
  } catch {
    baseAiApi = '/api/ai';
  }
} else if (!baseAiApi.startsWith('/api/ai')) {
  baseAiApi = '/api/ai';
}
const API_BASE = baseAiApi.replace(/\/$/, '');

async function safeJson(res) {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callBackendChat(messages) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const data = await safeJson(res);

  if (!res.ok || !data || !data.success) {
    const errMsg = data?.error || (res.status === 404
      ? 'Backend AI service not found (HTTP 404). Please ensure VITE_AUTH_API_URL is configured in your deployment settings.'
      : `Server error: HTTP ${res.status}`);
    const err = new Error(errMsg);
    err.errorType = data?.errorType || 'UNKNOWN';
    throw err;
  }

  return data.reply;
}

async function callBackendVision(imageFile, text = '') {
  const formData = new FormData();
  formData.append('image', imageFile);
  if (text) formData.append('text', text);

  const res = await fetch(`${API_BASE}/vision`, {
    method: 'POST',
    body: formData,
  });

  const data = await safeJson(res);

  if (!res.ok || !data || !data.success) {
    const errMsg = data?.error || (res.status === 404
      ? 'Backend AI service not found (HTTP 404). Please ensure VITE_AUTH_API_URL is configured in your deployment settings.'
      : `Server error: HTTP ${res.status}`);
    const err = new Error(errMsg);
    err.errorType = data?.errorType || 'UNKNOWN';
    throw err;
  }

  return data.reply;
}


// ── Formatted message renderer ──
const FormattedMessage = ({ text }) => {
  if (!text || typeof text !== 'string') return <div className="cb-msg-text">{String(text || '')}</div>;
  const lines = text.split('\n');
  return (
    <div className="cb-msg-text">
      {lines.map((line, i) => {
        // Headers with accent color
        const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) return (
          <div key={i} className="cb-msg-heading">
            <strong style={{ color: 'var(--accent-purple)', textShadow: '0 0 10px rgba(139, 92, 246, 0.3)' }}>
              {boldMatch[1]}
            </strong>
            {boldMatch[2] && <span>{boldMatch[2]}</span>}
          </div>
        );

        // Inline bolding
        if (line.includes('**')) {
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <div key={i} style={{ marginBottom: 4 }}>
              {parts.map((p, j) => j % 2 === 1 ?
                <strong key={j} className="cb-inline-bold" style={{ color: 'var(--accent-purple)' }}>{p}</strong> : p
              )}
            </div>
          );
        }

        if (line.startsWith('- ')) return (
          <div key={i} className="cb-msg-bullet">
            <span className="cb-bullet-dot" style={{ color: 'var(--accent-purple)' }}>•</span>
            <span>{line.slice(2)}</span>
          </div>
        );

        const numMatch = line.match(/^(\d+)\.\s(.+)$/);
        if (numMatch) return (
          <div key={i} className="cb-msg-step">
            <span className="cb-step-num" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
              {numMatch[1]}
            </span>
            <span>{numMatch[2]}</span>
          </div>
        );

        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        return <div key={i} style={{ marginBottom: 4 }}>{line}</div>;
      })}
    </div>
  );
};

// ── LocalStorage helpers ──
const STORAGE_KEY = 'laptopmd_chat_history';
function loadChatHistory() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveChatHistory(h) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch (e) { console.warn('Save failed:', e); } }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function timeAgo(ts) {
  const diff = Date.now() - ts, mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Main Component ──
const ChatbotPage = ({ toast }) => {
  const { user } = useAuth();
  const [chatHistory, setChatHistory] = useState(() => loadChatHistory());
  const [activeChatId, setActiveChatId] = useState(null);

  // New Persona Greeting
  const personaGreeting = "Welcome to Aegis AI, ask me Laptop related Questions";

  const [messages, setMessages] = useState(() => {
    const history = loadChatHistory();
    if (history.length > 0) return []; // Will be loaded by activeChatId effect
    return [{ role: 'assistant', content: personaGreeting }];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCounts, setEditCounts] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const recordingIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const sendVoiceMessage = async (audioBlob) => {
    setIsLoading(true);

    const userMsg = {
      role: 'user',
      content: '🎤 [Voice message transcribing...]',
      isVoice: true
    };

    let chatId = activeChatId;
    if (!chatId) {
      const nc = { 
        id: generateId(), 
        title: 'Voice Chat', 
        messages: [userMsg], 
        editCounts: {}, 
        createdAt: Date.now(), 
        updatedAt: Date.now() 
      };
      chatId = nc.id;
      setChatHistory(prev => [nc, ...prev]);
      setActiveChatId(chatId);
    }

    const updMsgs = [...messages, userMsg];
    setMessages(updMsgs);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const res = await fetch(`${API_BASE}/voice`, {
        method: 'POST',
        body: formData,
      });

      const data = await safeJson(res);

      if (!res.ok || !data || !data.success) {
        throw new Error(data?.error || `Server error: ${res.status}`);
      }

      // Update the user message to show the transcription
      const finalUserMsg = {
        role: 'user',
        content: `🎤 "${data.transcribedText}"`,
        isVoice: true
      };
      
      const withTranscribedMsg = [...updMsgs.slice(0, -1), finalUserMsg];
      const finalMsgs = [...withTranscribedMsg, { role: 'assistant', content: data.reply }];
      setMessages(finalMsgs);
      saveCurrentChat(finalMsgs, chatId);
    } catch (err) {
      const failedUserMsg = {
        role: 'user',
        content: `🎤 [Voice message transcription failed: ${err.message}]`,
        isVoice: true
      };
      const errMsg = { role: 'assistant', content: `⚠️ **Error:** ${err.message}` };
      const finalMsgs = [...updMsgs.slice(0, -1), failedUserMsg, errMsg];
      setMessages(finalMsgs);
      saveCurrentChat(finalMsgs, chatId);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // Match user browser language or English
        recognition.lang = navigator.language || 'en-US';
        latestTranscriptRef.current = '';

        recognition.onstart = () => {
          setIsRecording(true);
          setIsRecognitionActive(true);
          setRecordingTime(0);
          recordingIntervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
        };

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const currentText = finalTranscript + interimTranscript;
          setInput(currentText);
          latestTranscriptRef.current = currentText;
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === 'not-allowed') {
            stopRecording();
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          setIsRecognitionActive(false);
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
        };

        recognition.start();
      } catch (err) {
        console.error("Failed to start SpeechRecognition, falling back to MediaRecorder:", err);
        startMediaRecorder();
      }
    } else {
      startMediaRecorder();
    }
  };

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setIsRecognitionActive(false);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (isRecognitionActive && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      // Auto send on stop
      const textToSend = latestTranscriptRef.current.trim();
      if (textToSend) {
        sendMessage(textToSend);
      }
      latestTranscriptRef.current = '';
    } else if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (isRecognitionActive && recognitionRef.current) {
      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setIsRecognitionActive(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
      recognitionRef.current.abort();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
      setInput('');
      latestTranscriptRef.current = '';
    } else if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }
  };

  useEffect(() => { saveChatHistory(chatHistory); }, [chatHistory]);
  // Track current chat ID to avoid redundant updates
  const lastLoadedId = useRef(null);

  useEffect(() => { 
    if (activeChatId && activeChatId !== lastLoadedId.current) { 
      const c = chatHistory.find(c => c.id === activeChatId); 
      if (c) { 
        setMessages(c.messages || []); 
        setEditCounts(c.editCounts || {}); 
        lastLoadedId.current = activeChatId;
      } 
    } 
  }, [activeChatId, chatHistory]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [activeChatId]);

  const canEdit = (idx) => (editCounts[idx] || 0) < 5;

  const saveCurrentChat = useCallback((msgs, chatId = activeChatId, eCounts = editCounts) => {
    if (!chatId) return;
    setChatHistory(prev => {
      const idx = prev.findIndex(c => c.id === chatId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const firstUser = msgs.find(m => m.role === 'user');
      const contentStr = String(firstUser?.content || '');
      updated[idx] = { 
        ...updated[idx], 
        messages: msgs, 
        editCounts: eCounts, 
        title: firstUser ? contentStr.slice(0, 45) + (contentStr.length > 45 ? '...' : '') : updated[idx].title, 
        updatedAt: Date.now() 
      };
      return updated;
    });
  }, [activeChatId, editCounts]);

  const createNewChat = () => {
    const nc = { id: generateId(), title: 'New Chat', messages: [], editCounts: {}, createdAt: Date.now(), updatedAt: Date.now() };
    setChatHistory(prev => [nc, ...prev]);
    setActiveChatId(nc.id);
    setMessages([]);
    setInput('');
    setAttachments([]);
    setEditingIdx(null);
    setEditCounts({});
  };

  const deleteChat = (id, e) => {
    e?.stopPropagation();
    setChatHistory(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) { setActiveChatId(null); setMessages([]); }
    toast?.info('Chat deleted');
  };

  const deleteAllChats = () => {
    setChatHistory([]); setActiveChatId(null); setMessages([]); setShowDeleteAll(false);
    toast?.info('All chats deleted');
  };

  const copyResponse = async (text, idx) => {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); toast?.success('Copied!'); } catch { toast?.error('Copy failed'); }
  };

  // ── Send message — routes to correct backend endpoint based on attachment type ──
  const sendMessage = async (overrideText = null) => {
    const text = overrideText || input.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading) return;

    setIsLoading(true);

    // Separate image vs non-image attachments
    const imageAtts = attachments.filter(a => a.isImage);
    const otherAtts = attachments.filter(a => !a.isImage);

    const userMsg = {
      role: 'user',
      content: text || (attachments.length > 0 ? 'Please analyze the attached files.' : ''),
      imageNames: imageAtts.map(a => a.name),
      imagePreview: imageAtts.length > 0 ? imageAtts[0].preview : null,
    };

    let chatId = activeChatId;
    if (!chatId) {
      const nc = { 
        id: generateId(), 
        title: userMsg.content.slice(0, 45) + (userMsg.content.length > 45 ? '...' : ''), 
        messages: [userMsg], 
        editCounts: {}, 
        createdAt: Date.now(), 
        updatedAt: Date.now() 
      };
      chatId = nc.id;
      setChatHistory(prev => [nc, ...prev]);
      setActiveChatId(chatId);
    }

    const updMsgs = [...messages, userMsg];
    setMessages(updMsgs);
    setInput('');
    setAttachments([]);

    try {
      let reply;

      if (imageAtts.length > 0) {
        // ── Image path: send image file directly to /api/ai/vision ──
        reply = await callBackendVision(imageAtts[0].file, text);
      } else {
        // ── Text path: send conversation history to /api/ai/chat ──
        // Strip frontend-only fields before sending to backend
        const backendMessages = updMsgs.map(m => ({
          role: m.role,
          content: m.content,
        }));
        reply = await callBackendChat(backendMessages);
      }

      const newMsgs = [...updMsgs, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs, chatId);
    } catch (err) {
      const errMsg = { role: 'assistant', content: `⚠️ **Error:** ${err.message}` };
      const newMsgs = [...updMsgs, errMsg];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs, chatId);
    } finally { setIsLoading(false); }
  };

  const regenerateResponse = async (idx) => {
    if (isLoading) return;
    const before = messages.slice(0, idx);
    setMessages(before);
    setIsLoading(true);
    try {
      const backendMessages = before.map(m => ({ role: m.role, content: m.content }));
      const reply = await callBackendChat(backendMessages);
      const newMsgs = [...before, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs);
    } catch (err) {
      setMessages([...before, { role: 'assistant', content: `⚠️ **Error:** ${err.message}` }]);
    } finally { setIsLoading(false); }
  };

  const submitEdit = async (idx) => {
    if (!editText.trim() || isLoading) return;
    const before = messages.slice(0, idx);
    const editedMsg = { role: 'user', content: editText.trim() };
    const updMsgs = [...before, editedMsg];
    const newCounts = { ...editCounts, [idx]: (editCounts[idx] || 0) + 1 };
    setEditCounts(newCounts);
    setMessages(updMsgs);
    setEditingIdx(null);
    setEditText('');
    setIsLoading(true);
    try {
      const backendMessages = updMsgs.map(m => ({ role: m.role, content: m.content }));
      const reply = await callBackendChat(backendMessages);
      const newMsgs = [...updMsgs, { role: 'assistant', content: reply }];
      setMessages(newMsgs);
      saveCurrentChat(newMsgs, activeChatId, newCounts);
    } catch (err) {
      setMessages([...updMsgs, { role: 'assistant', content: `⚠️ **Error:** ${err.message}` }]);
    } finally { setIsLoading(false); }
  };



  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newAtts = files.map(f => ({
      name: f.name, size: f.size, type: f.type, file: f,
      isImage: f.type.startsWith('image/'),
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push({
            name: file.name || `pasted-image-${Date.now()}.png`,
            size: file.size,
            type: file.type,
            file: file,
            isImage: true,
            preview: URL.createObjectURL(file),
          });
        }
      }
    }
    if (pastedFiles.length > 0) {
      setAttachments(prev => [...prev, ...pastedFiles]);
      e.preventDefault();
    }
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => { const u = [...prev]; if (u[idx]?.preview) URL.revokeObjectURL(u[idx].preview); u.splice(idx, 1); return u; });
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const isWelcome = messages.length === 0;

  return (
    <div className="cb-page fade-in">
      <div className="cb-main">
        <div className="cb-chat-card">
          {/* Header */}
          <div className="cb-header">
            <div className="cb-header-left">
              <div className="cb-header-avatar"><Shield size={20} /></div>
              <div className="cb-header-info">
                <h2>Aegis AI</h2>
                <span className="cb-header-status"><span className="cb-dot-online" />{isLoading ? 'Processing…' : 'Shield Active'}</span>
              </div>
            </div>
            <div className="cb-header-actions">
              <button className="cb-icon-btn" onClick={createNewChat} title="New chat" id="new-chat-header-btn"><Plus size={16} /></button>
              <button className={`cb-icon-btn ${historyOpen ? 'active' : ''}`} onClick={() => setHistoryOpen(!historyOpen)} title="Chat history" id="toggle-history-btn">
                <Clock size={16} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="cb-messages-area">
            {isWelcome ? (
              <div className="cb-welcome">
                <div className="cb-welcome-glow" />
                <div className="cb-welcome-icon"><Shield size={30} /></div>
                <h2>Aegis AI Assistant</h2>
                <p>{personaGreeting}</p>

                <div className="cb-suggestions" style={{ marginTop: 30 }}>
                  <p className="cb-suggestions-label">Suggested Questions:</p>
                  <div className="cb-chips">
                    {[
                      "Why is my battery draining fast?",
                      "How to fix laptop overheating?",
                      "Analyze my hardware health"
                    ].map((txt, idx) => (
                      <button key={idx} className="cb-chip" onClick={() => setInput(txt)}>
                        {txt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cb-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`cb-bubble-row ${msg.role === 'user' ? 'user' : 'bot'}`}>
                    <div className={`cb-avatar ${msg.role === 'user' ? 'user-av' : 'bot-av'}`}>
                      {msg.role === 'user' ? <User size={15} /> : <Shield size={15} />}
                    </div>
                    <div className="cb-bubble-content">
                      {editingIdx === i ? (
                        <div className="cb-edit-box">
                          <textarea className="cb-edit-input" value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus />
                          <div className="cb-edit-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => submitEdit(i)}><Send size={12} /> Save &amp; Send</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingIdx(null); setEditText(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className={`cb-bubble ${msg.role === 'user' ? 'user-bbl' : 'bot-bbl'}`}>
                          {/* Show image preview if present */}
                          {msg.imagePreview && (
                            <div style={{ marginBottom: 8 }}>
                              <img src={msg.imagePreview} alt="Uploaded" className="cb-msg-img" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />
                            </div>
                          )}
                          {Array.isArray(msg.imageNames) && msg.imageNames.length > 0 && !msg.imagePreview && (
                            <div className="cb-img-badge"><ImageIcon size={12} /> {msg.imageNames.join(', ')}</div>
                          )}
                          <FormattedMessage text={msg.content} />
                        </div>
                      )}
                      {editingIdx !== i && (
                        <div className="cb-msg-actions">
                          {msg.role === 'user' && canEdit(i) && (
                            <button className="cb-action-btn" onClick={() => { setEditingIdx(i); setEditText(msg.content); }}>
                              <Edit3 size={11} /> Edit ({5 - (editCounts[i] || 0)})
                            </button>
                          )}
                          {msg.role === 'assistant' && (
                            <>
                              <button className="cb-action-btn" onClick={() => regenerateResponse(i)} disabled={isLoading}>
                                <RefreshCw size={11} /> Regenerate
                              </button>
                              <button className="cb-action-btn" onClick={() => copyResponse(msg.content, i)}>
                                {copiedIdx === i ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="cb-bubble-row bot">
                    <div className="cb-avatar bot-av"><Shield size={15} /></div>
                    <div className="cb-bubble-content"><div className="cb-bubble bot-bbl cb-typing"><div className="cb-typing-dots"><span /><span /><span /></div></div></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="cb-input-bar">
            <div className="cb-input-row">
              {isRecording ? (
                <div className="cb-recording-container">
                  <div className="cb-recording-status">
                    <span className="cb-recording-dot" />
                    <span className="cb-recording-timer">{formatTime(recordingTime)}</span>
                    <div className="cb-recording-wave">
                      <span className="cb-recording-bar" />
                      <span className="cb-recording-bar" />
                      <span className="cb-recording-bar" />
                      <span className="cb-recording-bar" />
                      <span className="cb-recording-bar" />
                    </div>
                  </div>
                  <div className="cb-recording-actions">
                    <button type="button" className="cb-recording-cancel" onClick={cancelRecording} title="Cancel recording">
                      <Trash2 size={16} />
                    </button>
                    <button type="button" className="cb-recording-stop" onClick={stopRecording}>
                      <Square size={10} fill="currentColor" style={{ marginRight: 4 }} /> Stop &amp; Send
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Attachment Button */}
                  <button
                    type="button"
                    className="cb-in-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file/image"
                    disabled={isLoading}
                  >
                    <Paperclip size={16} />
                  </button>

                  {/* Microphone Button */}
                  <button
                    type="button"
                    className="cb-mic-btn"
                    onClick={startRecording}
                    title="Record voice message"
                    disabled={isLoading}
                  >
                    <Mic size={16} />
                  </button>

                  <div className="cb-input-container">
                    {/* Selected Attachments Preview */}
                    {attachments.length > 0 && (
                      <div className="cb-attachments-inline">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="cb-att-pill">
                            {att.isImage ? (
                              <img src={att.preview} alt="preview" />
                            ) : (
                              <ImageIcon size={14} />
                            )}
                            <span style={{ fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.name}
                            </span>
                            <button type="button" onClick={() => removeAttachment(idx)}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea
                      ref={inputRef}
                      className="cb-input"
                      placeholder="Describe your laptop issue…"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      rows={1}
                      disabled={isLoading}
                      id="chatbot-main-input"
                    />
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  <button className={`cb-send ${(!input.trim() && !attachments.length) || isLoading ? 'disabled' : ''}`} onClick={() => sendMessage()} disabled={(!input.trim() && !attachments.length) || isLoading} id="chatbot-send-btn">
                    {isLoading ? <Loader size={16} className="spin-anim" /> : <Send size={16} />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Panel */}
      <aside className={`cb-history ${historyOpen ? 'open' : ''}`}>
        <div className="cb-history-header">
          <h3><Clock size={14} /> Chat History</h3>
          <button className="cb-icon-btn" onClick={() => setHistoryOpen(false)}><ChevronRight size={16} /></button>
        </div>
        <button className="cb-new-chat" onClick={createNewChat} id="new-chat-btn"><Plus size={14} /> New Chat</button>
        <div className="cb-history-list">
          {chatHistory.length === 0 ? (
            <div className="cb-history-empty"><MessageSquare size={24} /><p>No conversations yet</p><span>Start a new chat!</span></div>
          ) : chatHistory.map(chat => (
            <div key={chat.id} className={`cb-history-item ${activeChatId === chat.id ? 'active' : ''}`} onClick={() => { setActiveChatId(chat.id); setMessages(chat.messages); setEditingIdx(null); setEditCounts(chat.editCounts || {}); }}>
              <div className="cb-history-item-info"><MessageSquare size={13} /><div><span className="cb-history-title">{chat.title}</span><span className="cb-history-date">{timeAgo(chat.updatedAt)}</span></div></div>
              <button className="cb-history-del" onClick={(e) => deleteChat(chat.id, e)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
        {chatHistory.length > 0 && (
          <div className="cb-history-footer">
            {showDeleteAll ? (
              <div className="cb-del-confirm"><span>Delete all chats?</span><div className="cb-del-btns"><button className="cb-del-yes" onClick={deleteAllChats}>Delete all</button><button className="cb-del-no" onClick={() => setShowDeleteAll(false)}>Cancel</button></div></div>
            ) : (
              <button className="cb-del-all" onClick={() => setShowDeleteAll(true)} id="delete-all-chats-btn"><Trash2 size={12} /> Clear All</button>
            )}
          </div>
        )}
      </aside>
      {historyOpen && <div className="cb-history-backdrop" onClick={() => setHistoryOpen(false)} />}
    </div>
  );
};

export default ChatbotPage;
