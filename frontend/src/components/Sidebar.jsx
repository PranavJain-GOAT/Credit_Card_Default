export default function Sidebar({ currentTab, switchTab, theme, toggleTheme }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'underwrite', label: 'New Assessment', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'analysis', label: 'Analysis', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'history', label: 'Case History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" fill="white">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div className="brand-text-block">
          <span className="brand-name">NEXUS RISK</span>
          <span className="brand-sub">Credit Analytics</span>
        </div>
      </div>

      <div className="nav-section-label">Platform</div>

      <nav className="nav-menu">
        {navItems.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`nav-item${currentTab === item.id ? ' active' : ''}`}
            onClick={() => switchTab(item.id)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="theme-switch" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
          <span className="theme-label">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          <button className="theme-toggle-btn">
            <span className="toggle-circle"></span>
          </button>
        </div>
        <div className="analyst-profile">
          <div className="profile-avatar">N</div>
          <div className="profile-info">
            <span className="profile-name">Nexus Risk</span>
            <span className="profile-role">v2.0 · CatBoost Engine</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
