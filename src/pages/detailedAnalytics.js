import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
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
    };
    fetchData();
  }, [serviceName]);

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

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem" }}>
            {labels.map(cat => {
              const count = serviceData[cat];
              const pct = Math.round((count / total) * 100);
              return (
                <div key={cat} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  boxShadow: "var(--shadow-sm)",
                  borderTop: `3px solid ${getColor(cat)}`,
                }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{cat}</div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-base)", lineHeight: 1.2, marginTop: "0.25rem" }}>{count}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-light)", marginTop: "0.2rem" }}>{pct}%</div>
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
                <span className="table-info">Last {dateHistory.length} dates</span>
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
                      <tr key={dt}>
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

        </div>
      </div>
    </>
  );
}
