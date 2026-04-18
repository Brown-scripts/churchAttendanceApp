import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Navigation from '../components/Navigation';

const ACTION_CONFIG = {
  'Attendance Added':      { color: 'action-success',  label: 'Added',        icon: '+' },
  'Bulk Attendance Added': { color: 'action-success',  label: 'Bulk Added',   icon: '++' },
  'Attendance Removed':    { color: 'action-warning',  label: 'Removed',      icon: '–' },
  'Category Change':       { color: 'action-warning',  label: 'Category',     icon: '↻' },
  'Bulk Category Update':  { color: 'action-warning',  label: 'Bulk Cat.',    icon: '↻↻' },
  'Name Change':           { color: 'action-info',     label: 'Renamed',      icon: '✎' },
  'Member Added':          { color: 'action-primary',  label: 'Member Added', icon: '👤+' },
  'CSV Import':            { color: 'action-primary',  label: 'CSV Import',   icon: '⤓' },
  'User Added':            { color: 'action-primary',  label: 'User Added',   icon: '👤+' },
  'User Removed':          { color: 'action-secondary',label: 'User Removed', icon: '👤–' },
  'User Role Updated':     { color: 'action-info',     label: 'Role Update',  icon: '⚙' },
  'Data Export':           { color: 'action-primary',  label: 'Exported',     icon: '⤴' },
};

const PAGE_SIZE = 100;

const getActionConfig = (action) =>
  ACTION_CONFIG[action] || { color: 'action-default', label: action, icon: '•' };

// Bucket a date into Today / Yesterday / This week / Earlier
const bucketFor = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  if (d >= weekStart) return 'This week';
  return d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
};

const Logs = () => {
  const [user] = useAuthState(auth);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const [filterAction, setFilterAction] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);

  const allActionTypes = ['All', ...Object.keys(ACTION_CONFIG)];

  const fetchPage = useCallback(async (cursor = null) => {
    try {
      let q = cursor
        ? query(collection(db, 'logs'), orderBy('timestamp', 'desc'), startAfter(cursor), limit(PAGE_SIZE))
        : query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const newLogs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() || new Date(),
      }));
      const last = snap.docs[snap.docs.length - 1] || null;
      return { newLogs, last, reachedEnd: snap.docs.length < PAGE_SIZE };
    } catch (err) {
      console.error('Error fetching logs:', err);
      return { newLogs: [], last: null, reachedEnd: true };
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { newLogs, last, reachedEnd } = await fetchPage(null);
      setLogs(newLogs);
      setLastDoc(last);
      setHasMore(!reachedEnd);
      setLoading(false);
    })();
  }, [fetchPage]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    const { newLogs, last, reachedEnd } = await fetchPage(lastDoc);
    setLogs(prev => [...prev, ...newLogs]);
    setLastDoc(last || lastDoc);
    setHasMore(!reachedEnd);
    setLoadingMore(false);
  };

  const refresh = async () => {
    setLoading(true);
    const { newLogs, last, reachedEnd } = await fetchPage(null);
    setLogs(newLogs);
    setLastDoc(last);
    setHasMore(!reachedEnd);
    setLoading(false);
  };

  // Filter in-memory (server already ordered)
  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'All' && log.action !== filterAction) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!log.details?.toLowerCase().includes(q) &&
          !log.memberName?.toLowerCase().includes(q) &&
          !log.user?.toLowerCase().includes(q) &&
          !log.serviceName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group into buckets
  const grouped = filteredLogs.reduce((acc, log) => {
    const bucket = bucketFor(log.timestamp);
    if (!acc[bucket]) acc[bucket] = [];
    acc[bucket].push(log);
    return acc;
  }, {});

  // Preserve insertion order of buckets (since logs are desc-sorted)
  const bucketOrder = Object.keys(grouped);

  const todayCount = logs.filter(l => bucketFor(l.timestamp) === 'Today').length;
  const uniqueUsers = new Set(logs.map(l => l.user).filter(Boolean)).size;

  const clearFilters = () => {
    setFilterAction('All');
    setSearchTerm('');
  };

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
            <p>Every change, every action — tracked for accountability</p>
          </div>

          {/* KPI row */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Loaded</div>
              <div className="kpi-value">{logs.length.toLocaleString()}</div>
              <div className="kpi-sub">{hasMore ? 'more available' : 'all shown'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Today</div>
              <div className="kpi-value">{todayCount}</div>
              <div className="kpi-sub">actions since midnight</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Users</div>
              <div className="kpi-value">{uniqueUsers}</div>
              <div className="kpi-sub">unique contributors</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Filtered</div>
              <div className="kpi-value">{filteredLogs.length}</div>
              <div className="kpi-sub">matching entries</div>
            </div>
          </div>

          {/* Inline search + filter bar */}
          <div className="logs-toolbar">
            <input
              type="text"
              className="logs-search"
              placeholder="🔍 Search details, member, user, service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="logs-filter-select"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              {allActionTypes.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {(filterAction !== 'All' || searchTerm) && (
              <button onClick={clearFilters} className="btn-secondary btn-sm">Clear</button>
            )}
            <button onClick={refresh} className="btn-secondary btn-sm">Refresh</button>
          </div>

          {/* Timeline */}
          {filteredLogs.length === 0 ? (
            <div className="logs-empty">
              <div className="logs-empty-icon">🗒️</div>
              <p>No logs match your filters.</p>
            </div>
          ) : (
            <div className="logs-timeline">
              {bucketOrder.map(bucket => (
                <div key={bucket} className="logs-bucket">
                  <div className="logs-bucket-header">
                    <span className="logs-bucket-label">{bucket}</span>
                    <span className="logs-bucket-count">{grouped[bucket].length}</span>
                  </div>
                  <div className="logs-bucket-items">
                    {grouped[bucket].map(log => {
                      const cfg = getActionConfig(log.action);
                      const isExpanded = expandedLog === log.id;
                      const hasMembers = Array.isArray(log.members) && log.members.length > 0;
                      return (
                        <div
                          key={log.id}
                          className={`log-item ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => hasMembers && setExpandedLog(isExpanded ? null : log.id)}
                          style={hasMembers ? { cursor: 'pointer' } : undefined}
                        >
                          <div className={`log-icon log-icon-${cfg.color.replace('action-', '')}`}>
                            {cfg.icon}
                          </div>
                          <div className="log-body">
                            <div className="log-headline">
                              <span className={`action-badge ${cfg.color}`}>{cfg.label}</span>
                              <span className="log-details-text">{log.details}</span>
                              {hasMembers && (
                                <span className="log-chev">{isExpanded ? '▲' : '▼'}</span>
                              )}
                            </div>
                            <div className="log-meta-row">
                              <span className="log-meta-user">{log.user?.split('@')[0] || 'System'}</span>
                              <span className="log-meta-time">
                                {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {bucket !== 'Today' && ` · ${log.timestamp.toLocaleDateString()}`}
                              </span>
                            </div>
                            {isExpanded && hasMembers && (
                              <div className="log-members">
                                {log.members.map((m, i) => (
                                  <span key={i} className="log-member-pill">{m}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="logs-load-more">
                  <button
                    className="btn-primary"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : `Load ${PAGE_SIZE} more`}
                  </button>
                </div>
              )}
              {!hasMore && filteredLogs.length > 0 && (
                <div className="logs-end-marker">End of logs</div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Logs;
