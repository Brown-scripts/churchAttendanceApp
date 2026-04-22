import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, deleteDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/authContext";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";
import AnalyticsComponent from "../components/analytics";
import { useAttendanceRecords, invalidateCollection } from "../hooks/useFirestoreCollection";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { X, Trash2 } from "lucide-react";

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
  const toast = useToast();
  const confirm = useConfirm();

  // Attendees modal state
  const [attendeesModal, setAttendeesModal] = useState(null); // { date, attendees: [{id, name, category}] }
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  const { data: attendanceRecords, loading: attendanceLoading, refresh } = useAttendanceRecords();

  useEffect(() => {
    if (attendanceLoading || !attendanceRecords) return;
    const catMap = {};
    const dateMap = {};

    attendanceRecords.forEach(entry => {
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
  }, [attendanceRecords, attendanceLoading, serviceName]);

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
      toast.error("Failed to load attendees.");
      setAttendeesModal(null);
    } finally {
      setAttendeesLoading(false);
    }
  };

  const handleRemoveAttendee = async (attendee) => {
    const ok = await confirm({
      title: `Remove ${attendee.name}?`,
      message: `They'll be removed from ${serviceName} on ${attendeesModal.date}. This action is logged.`,
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
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
      invalidateCollection("attendance");
      refresh();
    } catch (err) {
      console.error("Error removing attendee:", err);
      toast.error("Failed to remove attendee.");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete all "${serviceName}" records?`,
      message: "This permanently removes every attendance record for this service across all dates. This cannot be undone.",
      confirmLabel: "Delete All",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const q = query(collection(db, "attendance"), where("serviceName", "==", serviceName));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(doc(db, "attendance", d.id));
      invalidateCollection("attendance");
      navigate("/analytics");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete.");
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

          {/* Chart with inline category summary */}
          <div className="chart-container">
            <div className="table-header">
              <div className="table-header-left">
                <h3>Category Distribution</h3>
                <span className="table-info">{labels.length} categor{labels.length === 1 ? 'y' : 'ies'}</span>
              </div>
            </div>
            <div className="category-pill-strip">
              {labels.map(cat => {
                const count = serviceData[cat];
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} className="category-pill" style={{ borderLeftColor: getColor(cat) }}>
                    <span className="category-pill-label">{cat}</span>
                    <span className="category-pill-value">{count}</span>
                    <span className="category-pill-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "1.25rem" }}>
              <AnalyticsComponent chartData={chartData} exportName={`${serviceName.replace(/\s+/g, '-')}_categories`} />
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
                      <th className="cell-center">Total</th>
                      {labels.map(c => <th key={c} className="cell-center">{c}</th>)}
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
                        <td className="cell-num cell-bold">{info.total}</td>
                        {labels.map(c => (
                          <td key={c} className="cell-num" style={{ color: info.cats[c] ? "var(--text-base)" : "var(--text-light)" }}>
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
          {attendeesModal && (() => {
            const humanDate = new Date(attendeesModal.date + "T00:00:00").toLocaleDateString("default", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            });
            const count = attendeesModal.attendees.length;
            return (
              <div className="modal-overlay" onClick={() => setAttendeesModal(null)}>
                <div className="modal-content attendees-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="attendees-modal-header">
                    <div className="attendees-modal-title">
                      <h2>{serviceName}</h2>
                      <div className="attendees-modal-meta">
                        <span>{humanDate}</span>
                        {!attendeesLoading && (
                          <>
                            <span className="meta-dot">·</span>
                            <span>{count} attendee{count === 1 ? "" : "s"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="modal-close-btn"
                      onClick={() => setAttendeesModal(null)}
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="attendees-modal-body">
                    {attendeesLoading ? (
                      <div className="loading-spinner"><div className="spinner" /><p>Loading…</p></div>
                    ) : count === 0 ? (
                      <div className="attendees-empty">No attendees recorded.</div>
                    ) : (
                      <ul className="attendees-list">
                        {attendeesModal.attendees.map(a => (
                          <li key={a.id} className="attendee-row">
                            <div className="attendee-info">
                              <span className="attendee-name">{a.name}</span>
                              <span className={`category-badge category-${a.category?.toLowerCase()}`}>{a.category}</span>
                            </div>
                            <AdminOnly>
                              <button
                                className="attendee-remove-btn"
                                onClick={() => handleRemoveAttendee(a)}
                                aria-label={`Remove ${a.name}`}
                                title="Remove attendee"
                              >
                                <Trash2 size={14} strokeWidth={2.25} />
                              </button>
                            </AdminOnly>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </>
  );
}
