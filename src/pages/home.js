import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Navigation from "../components/Navigation";
import logo from "../assets/image.png";
import generateReport from "../components/reportGenerator";

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

  // Dashboard stats
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalRecords: 0,
    thisMonthCount: 0,
    totalServices: 0,
    loading: true,
  });

  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, [auth]);

  // Fetch dashboard stats once
  useEffect(() => {
    const load = async () => {
      try {
        const [memberSnap, attendanceSnap] = await Promise.all([
          getDocs(collection(db, "membership")),
          getDocs(collection(db, "attendance")),
        ]);

        // Deduplicate members by normalised name
        const memberSet = new Set(memberSnap.docs.map(d => d.data().name?.toLowerCase().trim()));

        const now = new Date();
        const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const serviceSet = new Set();
        let thisMonth = 0;

        attendanceSnap.forEach(d => {
          const { serviceName, date } = d.data();
          if (serviceName) serviceSet.add(serviceName.trim());
          if (date && date.startsWith(thisMonthStr)) thisMonth++;
        });

        setStats({
          totalMembers: memberSet.size,
          totalRecords: attendanceSnap.size,
          thisMonthCount: thisMonth,
          totalServices: serviceSet.size,
          loading: false,
        });
      } catch (err) {
        console.error("Stats error:", err);
        setStats(s => ({ ...s, loading: false }));
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
    if (rangeMode === "month" && selectedMonth) {
      const [y, m] = selectedMonth.split("-");
      const last = new Date(Number(y), Number(m), 0).getDate();
      start = `${y}-${m}-01`;
      end   = `${y}-${m}-${String(last).padStart(2, "0")}`;
    } else if (rangeMode === "custom") {
      start = startDate || null;
      end   = endDate   || null;
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

          {/* Hero */}
          <div className="home-hero">
            <img src={logo} alt="Church Logo" className="hero-logo" />
            <div className="hero-text">
              <h1 className="hero-title">Universal Radiant Family</h1>
              <p className="hero-subtitle">Zone 1 — Attendance Management System</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="stats-row">
            <div className="stat-card-home">
              <div className="stat-icon blue">👥</div>
              <div className="stat-content">
                <div className="stat-label-home">Total Members</div>
                <div className="stat-value-home">
                  {stats.loading ? "—" : stats.totalMembers}
                </div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon teal">📋</div>
              <div className="stat-content">
                <div className="stat-label-home">Attendance Records</div>
                <div className="stat-value-home">
                  {stats.loading ? "—" : stats.totalRecords.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon green">📅</div>
              <div className="stat-content">
                <div className="stat-label-home">This Month</div>
                <div className="stat-value-home">
                  {stats.loading ? "—" : stats.thisMonthCount}
                </div>
                <div className="stat-sub">{monthLabel}</div>
              </div>
            </div>
            <div className="stat-card-home">
              <div className="stat-icon amber">🏛️</div>
              <div className="stat-content">
                <div className="stat-label-home">Services</div>
                <div className="stat-value-home">
                  {stats.loading ? "—" : stats.totalServices}
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
