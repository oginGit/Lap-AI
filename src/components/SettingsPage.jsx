import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Lock, 
  Shield, 
  Eye, 
  EyeOff, 
  Save, 
  Smartphone, 
  Bell,
  User as UserIcon,
  Activity
} from 'lucide-react';

const SettingsPage = ({ theme, toggleTheme, toast }) => {
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast?.error("New passwords don't match");
      return;
    }
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      toast?.success("Password updated successfully");
      setPasswords({ current: '', new: '', confirm: '' });
    }, 1500);
  };

  return (
    <div className="settings-page fade-in">
      <div className="settings-header">
        <div className="settings-title-row">
          <div className="settings-icon-glow">
            <SettingsIcon size={24} className="text-purple" />
          </div>
          <div>
            <h1>System Settings</h1>
            <p>Configure your LapGuard AI experience and security</p>
          </div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Appearance Section */}
        <div className="settings-card glass-card">
          <div className="card-header">
            <Activity size={20} className="text-purple" />
            <h3>Appearance</h3>
          </div>
          <div className="card-content">
            <p className="setting-description">Choose between light and dark themes for your dashboard.</p>
            <div className="theme-toggle-group">
              <button 
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && toggleTheme()}
              >
                <Moon size={18} />
                <span>Dark Mode</span>
                {theme === 'dark' && <div className="active-dot" />}
              </button>
              <button 
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme !== 'light' && toggleTheme()}
              >
                <Sun size={18} />
                <span>Light Mode</span>
                {theme === 'light' && <div className="active-dot" />}
              </button>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="settings-card glass-card security-card">
          <div className="card-header">
            <Lock size={20} className="text-purple" />
            <h3>Security & Authentication</h3>
          </div>
          <div className="card-content">
            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input 
                    type={showPass ? "text" : "password"} 
                    placeholder="Enter current password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>New Password</label>
                <div className="input-with-icon">
                  <Shield size={16} className="input-icon" />
                  <input 
                    type={showPass ? "text" : "password"} 
                    placeholder="Enter new password"
                    value={passwords.new}
                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                    required
                  />
                  <button 
                    type="button" 
                    className="toggle-pass"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="input-with-icon">
                  <Shield size={16} className="input-icon" />
                  <input 
                    type={showPass ? "text" : "password"} 
                    placeholder="Confirm new password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
                {!loading && <Save size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-page {
          padding: 30px;
          color: var(--text-primary);
          max-width: 1200px;
          margin: 0 auto;
        }

        .settings-header {
          margin-bottom: 40px;
        }

        .settings-title-row {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .settings-icon-glow {
          width: 54px;
          height: 54px;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 4px 0;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-purple) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .settings-header p {
          color: var(--text-secondary);
          margin: 0;
          font-size: 14px;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
          gap: 24px;
        }

        .glass-card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-light);
          border-radius: 24px;
          padding: 24px;
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          border-color: var(--accent-purple);
          box-shadow: 0 10px 40px rgba(0,0,0,0.3), 0 0 20px rgba(139, 92, 246, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-light);
        }

        .card-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .setting-description {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }

        .theme-toggle-group {
          display: flex;
          gap: 16px;
        }

        .theme-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-secondary);
          position: relative;
        }

        .theme-btn:hover {
          background: rgba(255,255,255,0.06);
          border-color: var(--text-secondary);
        }

        .theme-btn.active {
          background: rgba(139, 92, 246, 0.1);
          border-color: var(--accent-purple);
          color: var(--accent-purple);
        }

        .active-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 6px;
          height: 6px;
          background: var(--accent-purple);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--accent-purple);
        }

        /* Form Styles */
        .password-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
        }

        .input-with-icon input {
          width: 100%;
          padding: 12px 40px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-light);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .input-with-icon input:focus {
          outline: none;
          border-color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.05);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.1);
        }

        .toggle-pass {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }

        .save-btn {
          margin-top: 10px;
          padding: 14px;
          background: var(--accent-purple);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .save-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Toggle Switches */
        .toggle-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .toggle-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toggle-label {
          font-size: 14px;
          font-weight: 600;
          display: block;
        }

        .toggle-sub {
          font-size: 11px;
          color: var(--text-muted);
          margin: 2px 0 0 0;
        }

        .toggle-switch {
          width: 44px;
          height: 22px;
          background: rgba(255,255,255,0.1);
          border-radius: 100px;
          position: relative;
          cursor: pointer;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 18px;
          height: 18px;
          background: #fff;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: all 0.2s ease;
        }

        .toggle-switch.active {
          background: var(--accent-purple);
        }

        .toggle-switch.active::after {
          left: 24px;
        }

        .sync-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 14px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-indicator.online {
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
        }

        .sync-info {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 20px;
        }

        .outline-btn {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px solid var(--border-light);
          border-radius: 10px;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .outline-btn:hover {
          border-color: var(--text-secondary);
          color: #fff;
        }

        .text-purple {
          color: var(--accent-purple);
        }

        @media (max-width: 900px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsPage;
