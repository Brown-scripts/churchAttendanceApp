import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../context/authContext';
import { AdminOnly } from '../components/RoleBasedAccess';
import {
  LayoutDashboard, CheckSquare, BarChart3, UserRound, ScrollText, Shield,
  Sun, Moon, Menu, X,
} from 'lucide-react';

const logo = '/z1-logo.jpeg';

const navLinks = [
  { path: '/',           label: 'Dashboard',  Icon: LayoutDashboard },
  { path: '/attendance', label: 'Attendance', Icon: CheckSquare },
  { path: '/analytics',  label: 'Analytics',  Icon: BarChart3 },
  { path: '/membership', label: 'Members',    Icon: UserRound },
  { path: '/logs',       label: 'Audit Logs', Icon: ScrollText },
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

  const renderLink = ({ path, label, Icon }) => (
    <a
      href={path}
      className={`navbar-nav-link${isActive(path) ? ' active' : ''}`}
      onClick={(e) => { e.preventDefault(); go(path); }}
    >
      <Icon size={15} strokeWidth={2} className="navbar-nav-icon" />
      <span>{label}</span>
    </a>
  );

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
          {navLinks.map(link => (
            <li key={link.path} className="navbar-nav-item">{renderLink(link)}</li>
          ))}
          <AdminOnly>
            <li className="navbar-nav-item">
              {renderLink({ path: '/admin', label: 'Admin', Icon: Shield })}
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
            {isDarkMode ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
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
          {mobileOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`navbar-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <div className="navbar-mobile-nav">
          {navLinks.map(link => (
            <React.Fragment key={link.path}>{renderLink(link)}</React.Fragment>
          ))}
          <AdminOnly>
            {renderLink({ path: '/admin', label: 'Admin', Icon: Shield })}
          </AdminOnly>
        </div>
        <div className="navbar-mobile-actions">
          {user && (
            <div className="navbar-user" style={{ alignSelf: 'flex-start' }}>
              Signed in as {displayNameFor(user.email)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              style={{ width: 'auto', padding: '0.4rem 0.75rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
            >
              {isDarkMode
                ? <><Sun size={16} strokeWidth={2} /><span style={{fontSize:'0.85rem'}}>Light</span></>
                : <><Moon size={16} strokeWidth={2} /><span style={{fontSize:'0.85rem'}}>Dark</span></>}
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
