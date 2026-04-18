import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, deleteDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/authContext";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";
import AnalyticsComponent from "../components/analytics";

const CATEGORY_COLORS = {
  L100: "#3b82f6",
  L200: "#10b981",
  L300: "#f59e0b",
  L400: "#8b5cf6",
  WORKER: "#ef4444",
  OTHER: "#64748b",
  NEW: "#ec4899",
};

const getColor = (cat) =>
  CATEGORY_COLORS[cat?.toUpperCase()] ||
  "#" + ((parseInt(cat || "0", 36) * 0x9b3 & 0xffffff).toString(16).padStart(6, "0"));

export default function DetailedAnalytics() {
  const { serviceName } = useParams();
  const [serviceData, setServiceData] = useState(null);
  const [dateHistory, setDateHistory] = useState([]);
  const [user] = useAuthState(auth);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  // Attendees modal state
  const [attendeesModal, setAttendeesModal] = useState(null); // { date, attendees: [{id, name, category}] }
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "attendance"));
      const catMap = {};
      const dateMap = {};

      snap.forEach(d => {
        const entry = d.data();
        if (entry?.serviceName?.trim().toLowerCase() !== serviceName.trim().toLowerCase()) return;
        const cat = entry.category?.trim().toUpperCase() || "OTHER";
        catMap[cat] = (catMap[cat] || 0) + 1;

        const dt = entry.date || "Unknown";
        if (!dateMap[dt]) dateMap[dt] = { total: 0, cats: {} };
        dateMap[dt].total++;
        dateMap[dt].cats[cat] = (dateMap[dt].cats[cat] || 0) + 1;
      });

      setServiceData(catMap);
      const sorted = Object.entries(dateMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 10);
      setDateHistory(sorted);
    } catch (err) {
      console.error("Error:", err);
    }
  }, [serviceName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAttendeesModal = async (date) => {
    setAttendeesLoading(true);
    setAttendeesModal({ date, attendees: [] });
    try {
      const q = query(
        collection(db, "attendance"),
        where("serviceName", "==", serviceName),
        where("date", "==", date)
      );
      const snap = await getDocs(q);
      const attendees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      attendees.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAttendeesModal({ date, attendees });
    } catch (err) {
      console.error("Error fetching attendees:", err);
      alert("Failed to load attendees.");
      setAttendeesModal(null);
    } finally {
      setAttendeesLoading(false);
    }
  };

  const handleRemoveAttendee = async (attendee) => {
    if (!window.confirm(`Remove ${attendee.name} from ${serviceName} on ${attendeesModal.date}?`)) return;
    try {
      await deleteDoc(doc(db, "attendance", attendee.id));
      await addDoc(collection(db, "logs"), {
        action: "Attendance Removed",
        details: `Removed ${attendee.name} from ${serviceName} on ${attendeesModal.date}`,
        user: user?.email || "System",
        timestamp: serverTimestamp(),
        memberName: attendee.name,
        serviceName,
        date: attendeesModal.date,
      });
      // Refresh both the modal list and the parent data
      setAttendeesModal(prev => ({
        ...prev,
        attendees: prev.attendees.filter(a => a.id !== attendee.id),
      }));
      await fetchData();
    } catch (err) {
      console.error("Error removing attendee:", err);
      alert("Failed to remove attendee.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ALL records for "${serviceName}"? This cannot be undone.`)) return;
    try {
      const q = query(collection(db, "attendance"), where("serviceName", "==", serviceName));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db, "attendance", d.id));
      navigate("/analytics");
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  if (!serviceData) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="loading-spinner"><div className="spinner" /><p>Loading...</p></div>
          </div>
        </div>
      </>
    );
  }

  if (Object.keys(serviceData).length === 0) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="page-header-clean">
              <h1>{serviceName}</h1>
              <p>No attendance data found for this service.</p>
            </div>
            <div className="button-group">
              <button onClick={() => navigate("/analytics")} className="btn-secondary">← Back</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const labels = Object.keys(serviceData);
  const chartData = {
    labels,
    datasets: [{
      label: `${serviceName} — by Category`,
      data: labels.map(c => serviceData[c]),
      backgroundColor: labels.map(c => getColor(c)),
      borderColor: labels.map(c => getColor(c)),
      borderWidth: 2,
    }],
  };

  const total = Object.values(serviceData).reduce((a, b) => a + b, 0);

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="analytics-container">

          <div className="detail-header-row">
            <div className="page-header-clean" style={{ marginBottom: 0 }}>
              <h1>{serviceName}</h1>
              <p>{total.toLocaleString()} total attendance records</p>
            </div>
            <div className="button-group">
              <button onClick={() => navigate("/analytics")} className="btn-secondary">← Back</button>
              <AdminOnly>
                <button onClick={handleDelete} className="btn-danger">Delete Service</button>
              </AdminOnly>
            </div>
          </div>

          {/* Category breakdown cards */}
          <div className="category-cards-grid">
            {labels.map(cat => {
              const count = serviceData[cat];
              const pct = Math.round((count / total) * 100);
              return (
                <div key={cat} className="category-stat-card" style={{ borderTopColor: getColor(cat) }}>
                  <div className="category-stat-label">{cat}</div>
                  <div className="category-stat-value">{count}</div>
                  <div className="category-stat-pct">{pct}%</div>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="chart-container">
            <div className="table-header"><h3>Category Distribution</h3></div>
            <div style={{ padding: "1.25rem" }}>
              <AnalyticsComponent chartData={chartData} />
            </div>
          </div>

          {/* Recent dates */}
          {dateHistory.length > 0 && (
            <div className="table-card">
              <div className="table-header">
                <h3>Recent Sessions</h3>
                <span className="table-info">
                  Last {dateHistory.length} dates
                  {isAdmin() && <span className="edit-hint"> — click a row to view & manage attendees</span>}
                </span>
              </div>
              <div className="table-container-clean">
                <table className="members-table-clean">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: "center" }}>Total</th>
                      {labels.map(c => <th key={c} style={{ textAlign: "center" }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dateHistory.map(([dt, info]) => (
                      <tr
                        key={dt}
                        onClick={isAdmin() ? () => openAttendeesModal(dt) : undefined}
                        style={isAdmin() ? { cursor: "pointer" } : undefined}
                        className={isAdmin() ? "clickable-row" : ""}
                      >
                        <td style={{ fontWeight: 500 }}>{dt}</td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{info.total}</td>
                        {labels.map(c => (
                          <td key={c} style={{ textAlign: "center", color: info.cats[c] ? "var(--text-base)" : "var(--text-light)" }}>
                            {info.cats[c] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendees modal */}
          {attendeesModal && (
            <div className="modal-overlay" onClick={() => setAttendeesModal(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{serviceName}</h2>
                  <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Attendees on {attendeesModal.date}
                  </p>
                </div>
                <div className="modal-body">
                  {attendeesLoading ? (
                    <div className="loading-spinner"><div className="spinner" /><p>Loading...</p></div>
                  ) : attendeesModal.attendees.length === 0 ? (
                    <p className="text-muted" style={{ textAlign: "center", padding: "1rem" }}>No attendees.</p>
                  ) : (
                    <div className="attendees-list">
                      {attendeesModal.attendees.map(a => (
                        <div key={a.id} className="attendee-row">
                          <div className="attendee-info">
                            <span className="attendee-name">{a.name}</span>
                            <span className={`category-badge category-${a.category?.toLowerCase()}`}>{a.category}</span>
                          </div>
                          <AdminOnly>
                            <button className="btn-danger btn-sm" onClick={() => handleRemoveAttendee(a)}>
                              Remove
                            </button>
                          </AdminOnly>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="modal-buttons" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" }}>
                  <button className="btn-secondary" onClick={() => setAttendeesModal(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
