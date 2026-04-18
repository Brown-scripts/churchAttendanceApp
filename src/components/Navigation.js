import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../context/authContext';
import { AdminOnly } from '../components/RoleBasedAccess';
import logo from '../assets/image.png';

const navLinks = [
  { path: '/',           label: 'Dashboard' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/analytics',  label: 'Analytics'  },
  { path: '/membership', label: 'Members'    },
  { path: '/logs',       label: 'Audit Logs' },
];

const Navigation = ({ user }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { displayNameFor } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/welcome');
    } catch (err) {
      console.error('Logout Error:', err);
    }
  };

  const go = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <a href="/" className="navbar-brand" onClick={(e) => { e.preventDefault(); go('/'); }}>
          <img src={logo} alt="URF Logo" className="navbar-logo" />
          <span>URF Zone 1</span>
        </a>

        {/* Desktop Links */}
        <ul className="navbar-nav">
          {navLinks.map(({ path, label }) => (
            <li key={path} className="navbar-nav-item">
              <a
                href={path}
                className={`navbar-nav-link${isActive(path) ? ' active' : ''}`}
                onClick={(e) => { e.preventDefault(); go(path); }}
              >
                {label}
              </a>
            </li>
          ))}
          <AdminOnly>
            <li className="navbar-nav-item">
              <a
                href="/admin"
                className={`navbar-nav-link${isActive('/admin') ? ' active' : ''}`}
                onClick={(e) => { e.preventDefault(); go('/admin'); }}
              >
                Admin
              </a>
            </li>
          </AdminOnly>
        </ul>

        {/* Desktop Actions */}
        <div className="navbar-actions">
          {user && (
            <div className="navbar-user">
              {displayNameFor(user.email)}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          {user ? (
            <button onClick={handleLogout} className="navbar-logout">Sign out</button>
          ) : (
            <button onClick={() => go('/login')} className="navbar-login">Sign in</button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`navbar-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <div className="navbar-mobile-nav">
          {navLinks.map(({ path, label }) => (
            <a
              key={path}
              href={path}
              className={`navbar-nav-link${isActive(path) ? ' active' : ''}`}
              onClick={(e) => { e.preventDefault(); go(path); }}
            >
              {label}
            </a>
          ))}
          <AdminOnly>
            <a
              href="/admin"
              className={`navbar-nav-link${isActive('/admin') ? ' active' : ''}`}
              onClick={(e) => { e.preventDefault(); go('/admin'); }}
            >
              Admin
            </a>
          </AdminOnly>
        </div>
        <div className="navbar-mobile-actions">
          {user && (
            <div className="navbar-user" style={{ alignSelf: 'flex-start' }}>
              Signed in as {displayNameFor(user.email)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={toggleTheme} className="theme-toggle" style={{ width: 'auto', padding: '0.4rem 0.75rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
              {isDarkMode ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span style={{fontSize:'0.85rem'}}>Light</span></>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span style={{fontSize:'0.85rem'}}>Dark</span></>
              )}
            </button>
            {user ? (
              <button onClick={handleLogout} className="navbar-logout">Sign out</button>
            ) : (
              <button onClick={() => go('/login')} className="navbar-login">Sign in</button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
