import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';

const ACTION_CONFIG = {
  'Attendance Added':    { color: 'action-success',  label: 'Added'       },
  'Category Change':     { color: 'action-warning',  label: 'Category'    },
  'Bulk Category Update':{ color: 'action-warning',  label: 'Bulk Cat.'   },
  'Name Change':         { color: 'action-info',     label: 'Renamed'     },
  'User Added':          { color: 'action-primary',  label: 'User Added'  },
  'User Removed':        { color: 'action-secondary',label: 'User Removed'},
  'User Role Updated':   { color: 'action-info',     label: 'Role Update' },
  'Data Export':         { color: 'action-primary',  label: 'Exported'    },
};

const getActionConfig = (action) =>
  ACTION_CONFIG[action] || { color: 'action-default', label: action };

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
  const LOGS_PER_PAGE = 50;

  const allActionTypes = ['All', ...Object.keys(ACTION_CONFIG)];

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(1000));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() || new Date(),
      })));
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'All' && log.action !== filterAction) return false;
    if (filterUser !== 'All' && log.user !== filterUser) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!log.details?.toLowerCase().includes(q) &&
          !log.memberName?.toLowerCase().includes(q) &&
          !log.user?.toLowerCase().includes(q)) return false;
    }
    if (dateFrom || dateTo) {
      const d = log.timestamp;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }
    return true;
  });

  const uniqueUsers = [...new Set(logs.map(l => l.user))].filter(Boolean);
  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const currentLogs = filteredLogs.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

  const clearFilters = () => {
    setFilterAction('All');
    setFilterUser('All');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const todayCount = filteredLogs.filter(l =>
    l.timestamp.toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="logs-container">
            <div className="loading-spinner"><div className="spinner" /><p>Loading audit logs...</p></div>
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

          <div className="page-header-clean">
            <h1>Audit Logs</h1>
            <p>Track all system activities and changes</p>
          </div>

          {/* Stats */}
          <div className="logs-stats">
            <div className="stat-card">
              <h3>Matching Logs</h3>
              <p className="stat-number">{filteredLogs.length.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Today</h3>
              <p className="stat-number">{todayCount}</p>
            </div>
            <div className="stat-card">
              <h3>Users</h3>
              <p className="stat-number">{uniqueUsers.length}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="filters-card">
            <div className="filters-header">
              <h3>Filter & Search</h3>
              <button onClick={clearFilters} className="refresh-btn-small">Clear</button>
            </div>
            <div className="filters-grid">
              <div className="filter-group-clean">
                <label>Search</label>
                <input
                  type="text"
                  className="search-input-clean"
                  placeholder="Details, user, member..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <div className="filter-group-clean">
                <label>Action</label>
                <select
                  className="select-clean"
                  value={filterAction}
                  onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
                >
                  {allActionTypes.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group-clean">
                <label>User</label>
                <select
                  className="select-clean"
                  value={filterUser}
                  onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
                >
                  <option value="All">All Users</option>
                  {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="filter-group-clean">
                <label>From Date</label>
                <input
                  type="date"
                  className="date-input-clean"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <div className="filter-group-clean">
                <label>To Date</label>
                <input
                  type="date"
                  className="date-input-clean"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <div className="filter-actions">
                <button onClick={fetchLogs} className="btn-primary">Refresh</button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="table-card">
            <div className="table-header">
              <h3>Activity Log</h3>
              <span className="table-info">
                {currentLogs.length} of {filteredLogs.length} entries
              </span>
            </div>
            <div className="table-container-clean">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Member</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.map(log => {
                    const { color, label } = getActionConfig(log.action);
                    return (
                      <tr key={log.id} className="log-row">
                        <td className="log-timestamp">
                          {log.timestamp.toLocaleDateString()}{' '}
                          <span style={{ color: 'var(--text-light)' }}>
                            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="log-user">{log.user?.split('@')[0] || 'System'}</td>
                        <td className="log-action">
                          <span className={`action-badge ${color}`}>{label}</span>
                        </td>
                        <td className="log-details">{log.details}</td>
                        <td className="log-member">{log.memberName || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredLogs.length === 0 && (
              <div className="no-logs">No logs match your filters.</div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                >← Prev</button>
                <span className="pagination-info">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >Next →</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default Logs;
