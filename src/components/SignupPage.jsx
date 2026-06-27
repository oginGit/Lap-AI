/**
 * SignupPage.jsx — Centralized Premium Card
 */
import { useState } from 'react';
import { Shield, Lock, User, Mail, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import laptopImg from '../assets/laptop.png';

export default function SignupPage({ onSwitchToLogin }) {
  const { signup, googleLogin } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signup(form.fullName, form.email, form.password, form.confirmPassword);
      // Show success and redirect to login after a short delay
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        onSwitchToLogin();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Signup failed.');
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
                <img src={laptopImg} alt="Logo" style={{ width: '50px', height: '50px', filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))' }} />
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
            <h2>Create Account</h2>

          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Activity size={14} />
                {error}
              </div>
            )}
            {successMsg && (
              <div style={{ color: '#22c55e', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', background: 'rgba(34,197,94,0.1)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' }}>
                ✅ {successMsg}
              </div>
            )}

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <User className="auth-input-icon" size={18} />
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full Name"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={18} />
                <input
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

            <div className="auth-field">
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn-premium" disabled={loading}>
              {loading ? 'Creating...' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-footer" style={{ borderTop: 'none', marginTop: '32px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
            Already have an account? <button onClick={onSwitchToLogin} className="auth-link" style={{ fontSize: '12px', marginLeft: '5px', fontWeight: '700', letterSpacing: '1px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>LOGIN</button>
          </div>
        </div>
      </div>
    </div>
  );
}
