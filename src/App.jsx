/**
 * App.jsx — Root component
 * Manages global state and renders the correct page based on sidebar navigation.
 * Now with authentication gating — shows login/signup when not authenticated.
 */
import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DetectPage from './components/DetectPage';
import UserForm from './components/UserForm';
import ReportPage from './components/ReportPage';
import HistoryPage from './components/HistoryPage';
import ChatbotPage from './components/ChatbotPage';
import SettingsPage from './components/SettingsPage';
import { saveReport } from './utils/api';
import { Shield, Monitor, Activity } from 'lucide-react';
import './index.css';

// ─── Tiny in-app toast notification system ───────────────────────────────────
let _addToast = null;
export const toast = {
  success: (msg) => _addToast?.({ type: 'success', msg }),
  error: (msg) => _addToast?.({ type: 'error', msg }),
  info: (msg) => _addToast?.({ type: 'info', msg }),
};

const ToastContainer = ({ setAddToast }) => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _addToast = ({ type, msg }) => {
      const id = Date.now();
      setToasts((p) => [...p, { id, type, msg }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
    };
    setAddToast(_addToast);
    return () => {
      _addToast = null;
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            background:
              t.type === 'success'
                ? '#14532d'
                : t.type === 'error'
                ? '#7f1d1d'
                : '#1e3a5f',
            border: `1px solid ${
              t.type === 'success'
                ? '#16a34a'
                : t.type === 'error'
                ? '#dc2626'
                : '#2563eb'
            }`,
            borderRadius: 10,
            color: 'white',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'Inter',sans-serif",
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'slideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            minWidth: 280,
            maxWidth: 420,
          }}
        >
          <span style={{ fontSize: 16 }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
const App = () => {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'
  const [activePage, setActivePage] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [prevAuth, setPrevAuth] = useState(false);

  // Detect fresh login (transition from not-authenticated → authenticated)
  useEffect(() => {
    if (isAuthenticated && !prevAuth && !loading) {
      setShowLoginSuccess(true);
      const timer = setTimeout(() => setShowLoginSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevAuth(isAuthenticated);
  }, [isAuthenticated, loading]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [hardware, setHardware] = useState(() => {
    const saved = localStorage.getItem('hardware');
    return saved ? JSON.parse(saved) : null;
  });
  const [llmAnalysis, setLlmAnalysis] = useState(() => {
    const saved = localStorage.getItem('llmAnalysis');
    return saved ? JSON.parse(saved) : null;
  });
  const [userResponses, setUserResponses] = useState({
    issue: '',
    issueOther: '',
    timing: '',
    timingOther: '',
    heavyApps: '',
    heavyAppsOther: '',
    age: '',
    ageOther: '',
    changes: '',
    changesOther: '',
    usage: '',
    usageOther: '',
  });

  // Persist state to localStorage
  useEffect(() => {
    if (hardware) localStorage.setItem('hardware', JSON.stringify(hardware));
    else localStorage.removeItem('hardware');
  }, [hardware]);

  useEffect(() => {
    if (llmAnalysis) localStorage.setItem('llmAnalysis', JSON.stringify(llmAnalysis));
    else localStorage.removeItem('llmAnalysis');
  }, [llmAnalysis]);

  // Wrap setHardware to clear analysis when new data detected (as requested)
  const updateHardware = (data) => {
    setHardware(data);
    if (data && (!hardware || data.timestamp !== hardware.timestamp)) {
       setLlmAnalysis(null);
    }
  };

  // Auto-save to history after LLM analysis
  const handleSaveToHistory = async (reportData) => {
    try {
      await saveReport(reportData);
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  };

  // ─── Loading screen ───
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content fade-in">
          <div className="auth-loading-logo">
            <img 
              src="/src/assets/laptop_logo_white.png" 
              alt="Logo" 
              className="loading-logo-anim-lg"
            />
            <div className="spinner-ring-lg"></div>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '2px', marginBottom: '8px', background: 'linear-gradient(135deg, #fff 0%, var(--accent-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LAPGUARD-AI
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '500' }}>
            Care beyond maintenance
          </p>
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
             <div className="loading-bar-container"><div className="loading-bar-fill"></div></div>
             <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>INITIALIZING NEURAL INTERFACE...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Auth Pages (not logged in) ───
  if (!isAuthenticated) {
    return (
      <>
        {authView === 'login' ? (
          <LoginPage onSwitchToSignup={() => setAuthView('signup')} />
        ) : (
          <SignupPage onSwitchToLogin={() => setAuthView('login')} />
        )}
        <ToastContainer setAddToast={() => {}} />
      </>
    );
  }

  // ─── Main App (authenticated) ───
  const renderPage = () => {
    const sharedProps = {
      hardware,
      setHardware: updateHardware,
      llmAnalysis,
      setLlmAnalysis,
      userResponses,
      setUserResponses,
      toast,
      theme,
      toggleTheme,
    };
    switch (activePage) {
      case 'dashboard':
        return <Dashboard {...sharedProps} setActivePage={setActivePage} />;
      case 'detect':
        return <DetectPage {...sharedProps} />;
      case 'advisor':
        return (
          <UserForm
            {...sharedProps}
            setLlmAnalysis={setLlmAnalysis}
            onSave={handleSaveToHistory}
          />
        );
      case 'report':
        return (
          <ReportPage
            hardware={hardware}
            llmAnalysis={llmAnalysis}
            userResponses={userResponses}
            toast={toast}
          />
        );
      case 'history':
        return <HistoryPage toast={toast} />;
      case 'chatbot':
        return <ChatbotPage toast={toast} />;
      case 'settings':
        return <SettingsPage {...sharedProps} />;
      default:
        return <Dashboard {...sharedProps} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        lastScan={hardware?.timestamp}
        user={user}
        onLogout={logout}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-content">{renderPage()}</main>

      {/* Login Success Welcome Card */}
      {showLoginSuccess && (
        <div className="login-success-overlay">
          <div className="login-success-card">
            <div className="login-success-icon">✅</div>
            <h2>Welcome <strong>{user?.name || 'User'}</strong></h2>
            <p>In <strong>LapGuard-AI</strong></p>
          </div>
        </div>
      )}

      {/* Global toast notifications */}
      <ToastContainer setAddToast={() => {}} />
    </div>
  );
};

export default App;
