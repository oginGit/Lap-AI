/**
 * Sidebar component — navigation panel with user profile & logout
 */
import { Monitor, Cpu, Brain, History, FileText, BarChart3, LogOut, User, MessageCircle } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, section: 'main' },
  { id: 'detect',    label: 'Detect Hardware', icon: Cpu,      section: 'main' },
  { id: 'advisor',   label: 'AI Advisor',      icon: Brain,    section: 'main' },
  { id: 'chatbot',   label: 'Chatbot',         icon: MessageCircle, section: 'main' },
  { id: 'report',    label: 'PDF Report',      icon: FileText, section: 'tools' },
  { id: 'history',   label: 'History',         icon: History,  section: 'tools' },
];

const Sidebar = ({ activePage, setActivePage, lastScan, user, onLogout }) => {
  const sections = [...new Set(navItems.map(n => n.section))];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Monitor size={20} color="#60a5fa" />
        </div>
        <div>
          <h1>LapGuard-AI</h1>
          <span>Maintenance and Advisory System</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {navItems.filter(n => n.section === section).map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => setActivePage(item.id)}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer with user info & logout */}
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user-section">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                <User size={16} />
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">{user.name}</span>
                <span className="sidebar-user-email">{user.email}</span>
              </div>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Sign out"
              id="logout-btn"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <div className="status-badge" style={{ marginTop: user ? 12 : 0 }}>
          <div className="status-dot" />
          <span>
            {lastScan
              ? `Last scan: ${new Date(lastScan).toLocaleTimeString()}`
              : 'No scan yet'}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
