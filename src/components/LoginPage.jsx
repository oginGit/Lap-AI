/**
 * LoginPage.jsx — Centralized Premium Card
 */
import { useState, useRef } from 'react';
import { Shield, Lock, User, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import lapguardLogo from '../assets/lapguard_logo.png';

export default function LoginPage({ onSwitchToSignup }) {
  const { login, googleLogin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Simulation: Pass mock data
      await googleLogin({
        name: 'Sentinel User',
        email: 'sentinel.user@google.com',
        picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-bg-effects">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-grid-overlay" />
        </div>

        <div className="auth-form-wrapper">
          {loading && (
            <div className="auth-loading-overlay">
              <div className="auth-loading-spinner">
                <img src={lapguardLogo} alt="Loading" className="loading-logo-anim" style={{ borderRadius: '12px' }} />
                <div className="spinner-ring"></div>
              </div>
            </div>
          )}

          <div className="auth-logo-center">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '18px', 
                background: 'rgba(139, 92, 246, 0.1)', 
                border: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
              }}>
                <img src={lapguardLogo} alt="Logo" style={{ width: '55px', height: '55px', borderRadius: '14px', filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ 
                  fontSize: '24px', 
                  fontWeight: '900', 
                  color: '#fff', 
                  margin: 0,
                  background: 'linear-gradient(135deg, #fff 0%, var(--accent-purple) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '1.5px'
                }}>LAPGUARD-AI</h1>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Care Beyond Maintenance</p>
              </div>
            </div>
          </div>

          <div className="auth-form-header">
            <h2>Welcome Back</h2>

          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Activity size={14} />
                {error}
              </div>
            )}

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <User className="auth-input-icon" size={18} />
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn-premium" disabled={loading}>
              {loading ? 'Processing...' : 'Log In'}
            </button>
          </form>

          <div className="auth-footer" style={{ borderTop: 'none', marginTop: '32px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Don't have an account? <button onClick={onSwitchToSignup} className="auth-link" style={{ fontSize: '12px', marginLeft: '5px', fontWeight: '700', letterSpacing: '1px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>SIGNUP</button>
          </div>
        </div>
      </div>
    </div>
  );
}
