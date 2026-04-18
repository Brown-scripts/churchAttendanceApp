import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import Navigation from "../components/Navigation";
import logo from "../assets/image.png";
import generateReport from "../components/reportGenerator";
import { getServiceType } from "../utils/serviceType";

const normalizeName = (n) => (n || "").toLowerCase().trim();

// Compute per-type streaks (shared logic with membership page)
const computeStreaks = (serviceDates, memberDatesSet) => {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  for (const date of serviceDates) {
    if (memberDatesSet.has(date)) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  for (let i = serviceDates.length - 1; i >= 0; i--) {
    if (memberDatesSet.has(serviceDates[i])) currentStreak++;
    else break;
  }
  return { currentStreak, longestStreak };
};

// Animated counter hook
const useAnimatedCount = (target, duration = 900) => {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (target === 0 || target == null) { setValue(0); return; }
    startRef.current = null;
    let frameId;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) frameId = requestAnimationFrame(step);
      else setValue(target);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);
  return value;
};

const AnimatedNum = ({ value, loading }) => {
  const animated = useAnimatedCount(loading ? 0 : value);
  if (loading) return <>—</>;
  return <>{animated.toLocaleString()}</>;
};

const ACTION_LABELS = {
  'Attendance Added':      { label: 'marked present', icon: '+', color: 'teal' },
  'Bulk Attendance Added': { label: 'bulk attendance', icon: '++', color: 'teal' },
  'Attendance Removed':    { label: 'removed', icon: '–', color: 'amber' },
  'Category Change':       { label: 'category update', icon: '↻', color: 'amber' },
  'Name Change':           { label: 'renamed', icon: '✎', color: 'blue' },
  'Member Added':          { label: 'added member', icon: '👤', color: 'teal' },
  'CSV Import':            { label: 'CSV import', icon: '⤓', color: 'teal' },
  'User Added':            { label: 'user added', icon: '👤', color: 'teal' },
  'User Removed':          { label: 'user removed', icon: '👤–', color: 'gray' },
  'User Role Updated':     { label: 'role updated', icon: '⚙', color: 'blue' },
};

const relativeTime = (date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
};

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Home() {
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceList, setServiceList] = useState([]);
  const [serviceName, setServiceName] = useState("");
  const [reportFormat, setReportFormat] = useState("word");
  const [rangeMode, setRangeMode] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState({
    totalMembers: 0,
    totalRecords: 0,
    thisMonthCount: 0,
    totalServices: 0,
    loading: true,
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [topStreaks, setTopStreaks] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const navigate = useNavigate();
  const auth = getAuth();

  const today = new Date();
  const currentDayName = daysOfWeek[today.getDay()];
  const isSundayOrMonday = today.getDay() === 0 || today.getDay() === 1;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, [auth]);

  // Fetch all dashboard data in parallel
  useEffect(() => {
    const load = async () => {
      try {
        const [memberSnap, attendanceSnap, logSnap] = await Promise.all([
          getDocs(collection(db, "membership")),
          getDocs(collection(db, "attendance")),
          getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(5))),
        ]);

        const memberSet = new Set(
          memberSnap.docs.map(d => normalizeName(d.data().name)).filter(Boolean)
        );

        const now = new Date();
        const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const serviceSet = new Set();
        let thisMonth = 0;

        // Compute streaks from attendance (per service type)
        const sundayDates = new Set();
        const mondayDates = new Set();
        const memberAttend = new Map();

        attendanceSnap.forEach(d => {
          const data = d.data();
          const { serviceName, date, name, category } = data;
          if (serviceName) serviceSet.add(serviceName.trim());
          if (date && date.startsWith(thisMonthStr)) thisMonth++;

          const type = getServiceType(data);
          if (type === 'Sunday') sundayDates.add(date);
          else if (type === 'Monday') mondayDates.add(date);

          const key = normalizeName(name);
          if (!memberAttend.has(key)) {
            memberAttend.set(key, { name: name?.trim(), category, sun: new Set(), mon: new Set() });
          }
          const entry = memberAttend.get(key);
          if (type === 'Sunday') entry.sun.add(date);
          else if (type === 'Monday') entry.mon.add(date);
        });

        const sunSorted = Array.from(sundayDates).sort();
        const monSorted = Array.from(mondayDates).sort();

        const streakList = Array.from(memberAttend.values())
          .map(m => {
            const s = computeStreaks(sunSorted, m.sun);
            const mo = computeStreaks(monSorted, m.mon);
            return {
              name: m.name,
              category: m.category,
              currentStreak: Math.max(s.currentStreak, mo.currentStreak),
              type: s.currentStreak >= mo.currentStreak ? 'Sunday' : 'Monday',
            };
          })
          .filter(s => s.currentStreak > 0)
          .sort((a, b) => b.currentStreak - a.currentStreak)
          .slice(0, 5);

        setTopStreaks(streakList);

        setStats({
          totalMembers: memberSet.size,
          totalRecords: attendanceSnap.size,
          thisMonthCount: thisMonth,
          totalServices: serviceSet.size,
          loading: false,
        });

        setRecentActivity(
          logSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            timestamp: d.data().timestamp?.toDate() || new Date(),
          }))
        );
        setFeedLoading(false);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setStats(s => ({ ...s, loading: false }));
        setFeedLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const snap = await getDocs(collection(db, "attendance"));
        const s = new Set();
        snap.forEach(d => { if (d.data().serviceName) s.add(d.data().serviceName.trim()); });
        setServiceList(Array.from(s).sort());
      } catch (err) {
        console.error(err);
      }
    };
    if (isModalOpen) fetchServices();
  }, [isModalOpen]);

  const handleReportSubmit = (e) => {
    e.preventDefault();
    let start = null, end = null;
    if (!serviceName) {
      if (rangeMode === "month" && selectedMonth) {
        const [y, m] = selectedMonth.split("-");
        const last = new Date(Number(y), Number(m), 0).getDate();
        start = `${y}-${m}-01`;
        end   = `${y}-${m}-${String(last).padStart(2, "0")}`;
      } else if (rangeMode === "custom") {
        start = startDate || null;
        end   = endDate   || null;
      }
    }
    generateReport(serviceName || null, reportFormat, start, end);
    setIsModalOpen(false);
    setServiceName("");
  };

  const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="home-container">

          {/* Hero banner — personalized */}
          <div className="home-hero">
            <img src={logo} alt="Church Logo" className="hero-logo" />
            <div className="hero-text">
              <h1 className="hero-title">
                {user?.email ? `Welcome back, ${user.email.split('@')[0]}` : 'Universal Radiant Family'}
              </h1>
              <p className="hero-subtitle">
                It's {currentDayName} · {today.toLocaleDateString("default", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {isSundayOrMonday && (
              <button className="hero-today-btn" onClick={() => navigate("/attendance")}>
                Mark today's attendance →
              </button>
            )}
          </div>

          {/* Stats row with animated counters */}
          <div className="stats-row">
            <div className="stat-card-home">
              <div className="stat-icon blue">👥</div>
              <div className="stat-content">
                <div className="stat-label-home">Total Members</div>
                <div className="stat-value-home">
                  <AnimatedNum value={stats.totalMembers} loading={stats.loading} />
                </div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon teal">📋</div>
              <div className="stat-content">
                <div className="stat-label-home">Attendance Records</div>
                <div className="stat-value-home">
                  <AnimatedNum value={stats.totalRecords} loading={stats.loading} />
                </div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon green">📅</div>
              <div className="stat-content">
                <div className="stat-label-home">This Month</div>
                <div className="stat-value-home">
                  <AnimatedNum value={stats.thisMonthCount} loading={stats.loading} />
                </div>
                <div className="stat-sub">{monthLabel}</div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon amber">🏛️</div>
              <div className="stat-content">
                <div className="stat-label-home">Services</div>
                <div className="stat-value-home">
                  <AnimatedNum value={stats.totalServices} loading={stats.loading} />
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            <button className="action-button" onClick={() => navigate("/attendance")}>
              <div className="action-icon teal">✅</div>
              Mark Attendance
            </button>
            <button className="action-button" onClick={() => navigate("/analytics")}>
              <div className="action-icon blue">📊</div>
              Analytics
            </button>
            <button className="action-button" onClick={() => setIsModalOpen(true)}>
              <div className="action-icon green">📄</div>
              Generate Report
            </button>
            <button className="action-button" onClick={() => navigate("/membership")}>
              <div className="action-icon purple">👤</div>
              Members
            </button>
            <button className="action-button" onClick={() => navigate("/logs")}>
              <div className="action-icon amber">📋</div>
              Audit Logs
            </button>
          </div>

          {/* Two-column insights: activity + streaks */}
          <div className="home-insights">
            <div className="insight-card">
              <div className="insight-header">
                <h3>Recent Activity</h3>
                <button className="insight-link" onClick={() => navigate("/logs")}>View all →</button>
              </div>
              <div className="insight-body">
                {feedLoading ? (
                  <div className="insight-placeholder">Loading...</div>
                ) : recentActivity.length === 0 ? (
                  <div className="insight-placeholder">No activity yet.</div>
                ) : (
                  <ul className="activity-list">
                    {recentActivity.map(log => {
                      const cfg = ACTION_LABELS[log.action] || { label: log.action, icon: '•', color: 'gray' };
                      return (
                        <li key={log.id} className="activity-item">
                          <span className={`activity-dot activity-${cfg.color}`}>{cfg.icon}</span>
                          <div className="activity-text">
                            <div className="activity-headline">
                              <strong>{log.user?.split('@')[0] || 'System'}</strong> · {cfg.label}
                            </div>
                            <div className="activity-sub">
                              {log.memberName || log.serviceName || log.details?.split('.')[0]}
                            </div>
                          </div>
                          <span className="activity-time">{relativeTime(log.timestamp)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-header">
                <h3>Top Streaks</h3>
                <button className="insight-link" onClick={() => navigate("/membership")}>View all →</button>
              </div>
              <div className="insight-body">
                {feedLoading ? (
                  <div className="insight-placeholder">Loading...</div>
                ) : topStreaks.length === 0 ? (
                  <div className="insight-placeholder">No streaks yet.</div>
                ) : (
                  <ul className="streak-list">
                    {topStreaks.map((s, i) => (
                      <li key={s.name + i} className="streak-item">
                        <span className="streak-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                        <div className="streak-info">
                          <div className="streak-name">{s.name}</div>
                          <div className="streak-sub">{s.category} · {s.type}</div>
                        </div>
                        <span className="streak-num">🔥 {s.currentStreak}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Report Modal */}
          {isModalOpen && (
            <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Generate Report</h2>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleReportSubmit} className="modal-form">
                    <div className="form-group">
                      <label className="form-label">Service</label>
                      <select value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
                        <option value="">All Services</option>
                        {serviceList.map((n, i) => (
                          <option key={i} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    {!serviceName && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Period</label>
                          <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
                            <option value="month">Specific Month</option>
                            <option value="custom">Custom Date Range</option>
                            <option value="all">All Time</option>
                          </select>
                        </div>

                        {rangeMode === "month" && (
                          <div className="form-group">
                            <label className="form-label">Month</label>
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} required />
                          </div>
                        )}

                        {rangeMode === "custom" && (
                          <div className="form-group">
                            <label className="form-label">From</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <label className="form-label" style={{ marginTop: "0.5rem" }}>To</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                          </div>
                        )}
                      </>
                    )}

                    <div className="form-group">
                      <label className="form-label">Format</label>
                      <select value={reportFormat} onChange={(e) => setReportFormat(e.target.value)}>
                        <option value="word">Word Document (.docx)</option>
                        <option value="csv">CSV Spreadsheet (.csv)</option>
                      </select>
                    </div>

                    <div className="modal-buttons">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Generate
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
