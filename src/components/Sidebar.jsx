/**
 * Sidebar component — navigation panel with user profile & logout
 * Redesigned to match the reference image.
 */
import { useState } from 'react';
import laptopImg from '../assets/laptop.png';
import {
  LayoutDashboard,
  Cpu,
  Sparkles,
  MessageSquare,
  FileText,
  History,
  Settings,
  LogOut,
  Zap,
  Shield,
  Activity,
  Monitor
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'detect', label: 'Hardware Metrics', icon: Cpu },
  { id: 'advisor', label: 'AI Recommendation', icon: Sparkles },
  { id: 'chatbot', label: 'Chatbot', icon: MessageSquare },
  { id: 'report', label: 'PDF Report Generator', icon: FileText },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar = ({ activePage, setActivePage, user, onLogout }) => {
  return (
    <aside className="sidebar">
      {/* Logo Area - Refined for Branding */}
      <div className="sidebar-logo" style={{ 
        padding: '30px 24px', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        gap: '4px',
        textAlign: 'center'
      }}>
        <img src={laptopImg} alt="Logo" style={{ width: '50px', height: '50px', marginTop: 20, filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))' }} />
        <div>
          <h1 style={{ 
            fontSize: '18px', 
            fontWeight: '900', 
            color: '#fff', 
            letterSpacing: '1.5px', 
            margin: 0, 
            lineHeight: 1.2,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-purple) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
                        
            LAPGUARD-AI
          </h1>
          <p style={{ 
            fontSize: '9px', 
            fontWeight: '500', 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.8px',
            marginTop: '4px',
            margin: 0
          }}>
            Care beyond maintenance
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ padding: '0 16px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={18} />
              {item.label}
              {item.badge && (
                <span className="nav-badge">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ borderTop: 'none', padding: '24px 16px', marginTop: 'auto' }}>
        <button
          className="nav-item"
          onClick={onLogout}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', width: '100%', color: 'var(--text-secondary)', fontSize: '14px' }}
        >
          <LogOut size={18} />
          Logout option
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

