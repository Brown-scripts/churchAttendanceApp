import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/image.png';

const Navigation = ({ user }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleNavigation = (path) => {
    navigate(path);
    closeMobileMenu();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <a href="/" className="navbar-brand" onClick={(e) => { e.preventDefault(); handleNavigation('/'); }}>
          <img src={logo} alt="Church Logo" className="navbar-logo" />
          <span>URF Zone 1</span>
        </a>

        {/* Desktop Navigation */}
        <ul className="navbar-nav">
          <li className="navbar-nav-item">
            <a 
              href="/" 
              className={`navbar-nav-link ${isActive('/') ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavigation('/'); }}
            >
              Home
            </a>
          </li>
          <li className="navbar-nav-item">
            <a 
              href="/attendance" 
              className={`navbar-nav-link ${isActive('/attendance') ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavigation('/attendance'); }}
            >
              Attendance
            </a>
          </li>
          <li className="navbar-nav-item">
            <a 
              href="/analytics" 
              className={`navbar-nav-link ${isActive('/analytics') ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNavigation('/analytics'); }}
            >
              Analytics
            </a>
          </li>
        </ul>

        {/* Desktop Actions */}
        <div className="navbar-actions">
          {user && (
            <div className="navbar-user">
              Welcome, {user.email?.split('@')[0] || 'User'}
            </div>
          )}

          {/* Theme Toggle Button */}
          <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
            {isDarkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {user ? (
            <button onClick={handleLogout} className="navbar-logout">
              Logout
            </button>
          ) : (
            <button onClick={() => handleNavigation('/login')} className="navbar-login">
              Login
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="navbar-mobile-toggle" onClick={toggleMobileMenu}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="navbar-mobile-nav">
          <a 
            href="/" 
            className={`navbar-nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNavigation('/'); }}
          >
            Home
          </a>
          <a 
            href="/attendance" 
            className={`navbar-nav-link ${isActive('/attendance') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNavigation('/attendance'); }}
          >
            Attendance
          </a>
          <a 
            href="/analytics" 
            className={`navbar-nav-link ${isActive('/analytics') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNavigation('/analytics'); }}
          >
            Analytics
          </a>
        </div>
        
        <div className="navbar-mobile-actions">
          {user && (
            <div className="navbar-user">
              Welcome, {user.email?.split('@')[0] || 'User'}
            </div>
          )}

          {/* Mobile Theme Toggle */}
          <button onClick={toggleTheme} className="theme-toggle mobile">
            {isDarkMode ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <span>Dark Mode</span>
              </>
            )}
          </button>

          {user ? (
            <button onClick={handleLogout} className="navbar-logout">
              Logout
            </button>
          ) : (
            <button onClick={() => handleNavigation('/login')} className="navbar-login">
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
