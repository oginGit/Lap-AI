/**
 * LaptopChatbot — Floating AI Technical Support Chatbot
 * Positioned in the bottom-right corner of the AI Advisor page.
 * All AI requests go through the secure Express backend at /api/ai/chat.
 * No API keys are exposed in the frontend.
 */
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Maximize2, Loader, Paperclip, Mic, Square, Trash2 } from 'lucide-react';

// ── System prompt for the AI Technical Support Assistant ─────────────────────
const SYSTEM_PROMPT = `You are a professional, friendly, and highly capable AI Laptop Technical Support Assistant developed for LapGuard AI.
TONE & STYLE:
- Adopt a warm, empathetic, engaging, and highly conversational human-like tone, exactly like ChatGPT.
- Avoid stiff, robotic, or overly formulaic answers. Talk to the user like a friendly expert who genuinely cares about solving their problem.
- For simple issues: Give a direct, conversational, and easy-to-understand solution.
- For complex issues: Explain the situation naturally, list potential causes clearly, provide step-by-step troubleshooting in a friendly guide format, and offer practical preventive tips organically.
IMAGE UNDERSTANDING:
- When the user shares an image, explain what you see in the image and connect it directly to their issue in a conversational way.
- If the image is completely unrelated to laptops, politely ask them to share laptop-related images so you can assist.
CORE SCOPE:
- Restrict your support to laptop-related issues (battery, charging, power, thermals, performance, SSD/HDD storage, RAM, screen/display, keyboard, touchpad, OS, drivers, WiFi, security).
- If the user asks something completely unrelated to laptops, reply politely: "I'd love to help, but I specialize in diagnosing and solving laptop-related technical issues. Feel free to ask me anything about your laptop!"`;

// ── Call Backend Chat API ──────────────────────────────
async function callBackendChat(messages) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Server error: HTTP ${response.status}`);
  }

  return data.reply;
}

// ── Format message text with basic markdown-like styling ─────────────────────
const FormattedMessage = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="chatbot-message-text">
      {lines.map((line, i) => {
        // Bold headers like **Problem Explanation:**
        const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
          return (
            <div key={i} style={{ marginBottom: 4 }}>
              <strong style={{ color: 'var(--accent-purple)', fontSize: 12 }}>{boldMatch[1]}</strong>
              <span>{boldMatch[2]}</span>
            </div>
          );
        }
        // Bullet points
        if (line.startsWith('- ')) {
          return (
            <div key={i} style={{ paddingLeft: 12, marginBottom: 2, display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--accent-purple)', flexShrink: 0 }}>•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        // Numbered steps
        const numMatch = line.match(/^(\d+)\.\s(.+)$/);
        if (numMatch) {
          return (
            <div key={i} style={{ paddingLeft: 12, marginBottom: 2, display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, fontWeight: 700, fontSize: 11 }}>{numMatch[1]}.</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        // Empty lines
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginBottom: 2 }}>{line}</div>;
      })}
    </div>
  );
};

// ── Main Chatbot Component ────────────────────────────────────────────────────
const LaptopChatbot = ({ hardware }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `👋 Hello! I'm your **AI Laptop Technical Support Assistant**.

I can help you troubleshoot:
- 🔋 Battery issues
- ⚡ Performance problems
- 💾 Storage issues
- 🌡️ Overheating concerns
- 🐢 Slow startup

What laptop issue can I help you with today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null); // base64 string
  const [attachedImageFile, setAttachedImageFile] = useState(null); // File object
  
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
    };

    const updMsgs = [...messages, userMsg];
    setMessages(updMsgs);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const res = await fetch(`/api/ai/voice`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      // Update the user message to show the transcription
      const finalUserMsg = {
        role: 'user',
        content: `🎤 "${data.transcribedText}"`,
      };
      
      setMessages([...updMsgs.slice(0, -1), finalUserMsg, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const failedUserMsg = {
        role: 'user',
        content: `🎤 [Voice message transcription failed: ${err.message}]`,
      };
      const errMsg = { role: 'assistant', content: `⚠️ **Error:** ${err.message}` };
      setMessages([...updMsgs.slice(0, -1), failedUserMsg, errMsg]);
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please attach image files only.');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result); // Base64 encoding URI
      setAttachedImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachedImage(reader.result); // Base64 encoding URI
            setAttachedImageFile(file);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !attachedImageFile) return;
    if (isLoading) return;

    // Append user message
    const userMsg = { 
      role: 'user', 
      content: text || 'Please analyze the attached image.',
      imagePreview: attachedImage 
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    const imageFileToSend = attachedImageFile;
    removeAttachedImage();
    setIsLoading(true);

    try {
      let reply;
      if (imageFileToSend) {
        // Send to vision endpoint via express backend
        const formData = new FormData();
        formData.append('image', imageFileToSend);
        if (text) formData.append('text', text);

        const response = await fetch('/api/ai/vision', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Server error: HTTP ${response.status}`);
        }
        reply = data.reply;
      } else {
        // Include hardware context if available
        let contextualMessages = updatedMessages;
        if (hardware && updatedMessages.length === 2) {
          // Inject hardware context into the first user message
          const hwContext = `[System Context - Hardware Metrics]
Battery Health: ${hardware.battery?.health?.toFixed(0) ?? 'N/A'}%
Cycle Count: ${hardware.battery?.cycles ?? 'N/A'}
Charging: ${hardware.battery?.isCharging ? 'Yes' : 'No'}
CPU Temperature: ${hardware.cpu?.temperature?.toFixed(1) ?? 'N/A'}°C
CPU Usage: ${hardware.cpu?.usage?.toFixed(1) ?? 'N/A'}%
Drive Type: ${hardware.drive?.type ?? 'Unknown'}
Drive Health: ${hardware.drive?.health?.toFixed(0) ?? 'N/A'}%
Overall Health Score: ${hardware.overallHealth ?? 'N/A'}/100

User Issue: ${text}`;
          contextualMessages = [
            messages[0],
            { role: 'user', content: hwContext },
          ];
        }

        // Format messages for the backend (just role and content, stripping frontend-only fields)
        const backendMessages = contextualMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        reply = await callBackendChat(backendMessages);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      let userMessage = `⚠️ **Error:** ${err.message}\n\nThe AI service may be temporarily unavailable. Please try again shortly.`;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: userMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          className="chatbot-fab"
          onClick={() => setIsOpen(true)}
          title="Open AI Technical Support Chat"
          id="chatbot-fab-btn"
        >
          <MessageCircle size={22} />
          <span className="chatbot-fab-label">AI Support</span>
          <span className="chatbot-fab-dot" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className={`chatbot-window ${isMinimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <Bot size={16} />
              </div>
              <div>
                <div className="chatbot-name">Aegis AI</div>
                <div className="chatbot-status">
                  <span className="chatbot-online-dot" />
                  {isLoading ? 'Thinking...' : 'Online'}
                </div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-icon-btn"
                onClick={() => setIsMinimized(m => !m)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button
                className="chatbot-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Hardware context badge */}
              {hardware && (
                <div className="chatbot-hw-badge">
                  <span>🔍 Using your live hardware metrics for personalized advice</span>
                </div>
              )}

              {/* Messages */}
              <div className="chatbot-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`chatbot-bubble-wrap ${msg.role === 'user' ? 'user' : 'bot'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="chatbot-bubble-avatar bot-avatar">
                        <Bot size={12} />
                      </div>
                    )}
                    <div className={`chatbot-bubble ${msg.role === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                      {msg.imagePreview && (
                        <div style={{ marginBottom: 6 }}>
                          <img 
                            src={msg.imagePreview} 
                            alt="attachment" 
                            style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, objectFit: 'cover' }} 
                          />
                        </div>
                      )}
                      <FormattedMessage text={msg.content} />
                    </div>
                    {msg.role === 'user' && (
                      <div className="chatbot-bubble-avatar user-avatar">
                        <User size={12} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="chatbot-bubble-wrap bot">
                    <div className="chatbot-bubble-avatar bot-avatar">
                      <Bot size={12} />
                    </div>
                    <div className="chatbot-bubble bot-bubble chatbot-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {attachedImage && (
                  <div style={{ padding: '8px 15px 0', display: 'flex', gap: 8, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img 
                        src={attachedImage} 
                        alt="attached preview" 
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-light)' }} 
                      />
                      <button
                        onClick={removeAttachedImage}
                        style={{ 
                          position: 'absolute', 
                          top: -6, 
                          right: -6, 
                          background: '#ef4444', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '50%', 
                          width: 16, 
                          height: 16, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: 'pointer', 
                          fontSize: 10 
                        }}
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="chatbot-input-area" style={{ width: '100%' }}>
                  {isRecording ? (
                    <div className="cb-recording-container" style={{ width: '100%' }}>
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
                          <Trash2 size={15} />
                        </button>
                        <button type="button" className="cb-recording-stop" onClick={stopRecording}>
                          <Square size={10} fill="currentColor" style={{ marginRight: 4 }} /> Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="chatbot-icon-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image"
                        disabled={isLoading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                      >
                        <Paperclip size={18} />
                      </button>

                      <button
                        type="button"
                        className="chatbot-mic-btn"
                        onClick={startRecording}
                        title="Record voice message"
                        disabled={isLoading}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                      >
                        <Mic size={18} />
                      </button>

                      <textarea
                        ref={inputRef}
                        className="chatbot-input"
                        placeholder="Describe your laptop issue..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        rows={1}
                        disabled={isLoading}
                        id="chatbot-input"
                      />

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                      />

                      <button
                        className={`chatbot-send-btn ${(!input.trim() && !attachedImage) || isLoading ? 'disabled' : ''}`}
                        onClick={sendMessage}
                        disabled={(!input.trim() && !attachedImage) || isLoading}
                        title="Send message"
                      >
                        {isLoading ? <Loader size={16} className="spin-anim" /> : <Send size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="chatbot-footer-note">
                Secured by LapGuard Backend • Battery Metrics Health Analyzer
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default LaptopChatbot;
