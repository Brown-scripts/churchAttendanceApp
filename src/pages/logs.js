import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';

const Logs = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('All');
  const [filterUser, setFilterUser] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(50);

  const actionTypes = ['All', 'Attendance Added', 'Category Change', 'Data Export'];

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const logsRef = collection(db, 'logs');
      const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));
      const logsSnapshot = await getDocs(logsQuery);
      
      const logsData = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      setLogs(logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = filterAction === 'All' || log.action === filterAction;
    const matchesUser = filterUser === 'All' || log.user === filterUser;
    const matchesSearch = log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const logDate = log.timestamp;
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        matchesDate = matchesDate && logDate >= fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && logDate <= toDate;
      }
    }
    
    return matchesAction && matchesUser && matchesSearch && matchesDate;
  });

  const uniqueUsers = [...new Set(logs.map(log => log.user))].filter(Boolean);

  // Pagination
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);



  const clearFilters = () => {
    setFilterAction('All');
    setFilterUser('All');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'Attendance Added': return '•';
      case 'Category Change': return '→';
      case 'Data Export': return '↓';
      default: return '•';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'Attendance Added': return 'success';
      case 'Category Change': return 'warning';
      case 'Login': return 'info';
      case 'Logout': return 'secondary';
      case 'Data Export': return 'primary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="logs-container">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading audit logs...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="logs-container">
        {/* Page Header */}
        <div className="page-header-clean">
          <h1>Audit Logs</h1>
          <p>Track all system activities and changes</p>
        </div>

        {/* Filters Card */}
        <div className="filters-card">
          <div className="filters-header">
            <h3>Filter & Search</h3>

          </div>

          <div className="filters-grid">
            <div className="filter-group-clean">
              <label>Search Logs</label>
              <input
                type="text"
                placeholder="Search by details, user, or member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-clean"
              />
            </div>

            <div className="filter-group-clean">
              <label>Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="select-clean"
              >
                {actionTypes.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div className="filter-group-clean">
              <label>User</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="select-clean"
              >
                <option value="All">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>

            <div className="filter-group-clean">
              <label>From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="date-input-clean"
              />
            </div>

            <div className="filter-group-clean">
              <label>To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="date-input-clean"
              />
            </div>

            <div className="filter-actions">
              <button onClick={clearFilters} className="btn-secondary">
                Clear Filters
              </button>
              <button onClick={fetchLogs} className="btn-primary">
                Refresh
              </button>
            </div>
          </div>
        </div>

      {/* Statistics */}
      <div className="logs-stats">
        <div className="stat-card">
          <h3>Total Logs</h3>
          <p className="stat-number">{filteredLogs.length}</p>
        </div>
        <div className="stat-card">
          <h3>Today's Activities</h3>
          <p className="stat-number">
            {filteredLogs.filter(log => {
              const today = new Date();
              const logDate = log.timestamp;
              return logDate.toDateString() === today.toDateString();
            }).length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Active Users</h3>
          <p className="stat-number">{uniqueUsers.length}</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Member</th>
            </tr>
          </thead>
          <tbody>
            {currentLogs.map((log) => (
              <tr key={log.id} className="log-row">
                <td className="log-timestamp">
                  {log.timestamp.toLocaleString()}
                </td>
                <td className="log-user">{log.user || 'System'}</td>
                <td className="log-action">
                  <span className={`action-badge action-${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)} {log.action}
                  </span>
                </td>
                <td className="log-details">{log.details}</td>
                <td className="log-member">{log.memberName || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {totalPages} ({filteredLogs.length} total logs)
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {filteredLogs.length === 0 && (
        <div className="no-logs">
          <p>No logs found matching your criteria.</p>
        </div>
      )}

      {/* Floating Quick Access Menu */}
      <div className="floating-quick-menu">
        <div className="quick-menu-item" onClick={() => navigate('/')} title="Dashboard">
          <span className="menu-icon">🏠</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/attendance')} title="Add Attendance">
          <span className="menu-icon">➕</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/analytics')} title="Analytics">
          <span className="menu-icon">📊</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/membership')} title="Membership">
          <span className="menu-icon">👥</span>
        </div>
        
        </div>
        </div>
      </div>
    </>
  );
};

export default Logs;
