import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Navigation from "../components/Navigation";
import AnalyticsComponent from "../components/analytics";

const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#f97316","#84cc16","#ec4899","#6366f1",
  "#14b8a6","#f43f5e",
];

export default function Analytics() {
  const [services, setServices] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, "attendance"));
        const svc = {};
        snap.forEach(d => {
          const { serviceName, category } = d.data();
          if (!svc[serviceName]) svc[serviceName] = { total: 0, categories: {} };
          svc[serviceName].total += 1;
          svc[serviceName].categories[category] = (svc[serviceName].categories[category] || 0) + 1;
        });
        setServices(Object.keys(svc));
        setAttendanceData(svc);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="loading-spinner">
              <div className="spinner" />
              <p>Loading analytics...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!services.length) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="page-header-clean">
              <h1>Attendance Analytics</h1>
              <p>No attendance records found yet.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const chartData = {
    labels: services,
    datasets: [{
      label: "Total Attendance",
      data: services.map(s => attendanceData[s]?.total || 0),
      backgroundColor: COLORS.slice(0, services.length),
      borderColor: COLORS.slice(0, services.length),
      borderWidth: 2,
    }],
  };

  const totalAttendance = services.reduce((sum, s) => sum + (attendanceData[s]?.total || 0), 0);

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="analytics-container">

          <div className="page-header-clean">
            <h1>Attendance Analytics</h1>
            <p>
              {totalAttendance.toLocaleString()} total records across {services.length} service{services.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Chart */}
          <div className="chart-container">
            <div className="table-header">
              <h3>Attendance by Service</h3>
            </div>
            <div style={{ padding: "1.25rem" }}>
              <AnalyticsComponent chartData={chartData} />
            </div>
          </div>

          {/* Service cards */}
          <div className="services-section">
            <h3>Services — click to view breakdown</h3>
            <div className="service-list">
              {services.map((service, i) => {
                const data = attendanceData[service];
                const pct = totalAttendance > 0 ? Math.round((data.total / totalAttendance) * 100) : 0;
                return (
                  <button
                    key={service}
                    className="service-button"
                    onClick={() => navigate(`/analytics/${encodeURIComponent(service)}`)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: COLORS[i % COLORS.length],
                        flexShrink: 0,
                      }} />
                      <div className="service-name">{service}</div>
                    </div>
                    <div className="service-count">{data.total.toLocaleString()} records · {pct}% of total</div>
                    {/* Mini category bar */}
                    <div style={{ display: "flex", gap: "2px", marginTop: "0.5rem", height: "4px", borderRadius: "2px", overflow: "hidden" }}>
                      {Object.values(data.categories).map((v, ci) => (
                        <div key={ci} style={{
                          flex: v,
                          background: COLORS[ci % COLORS.length],
                          opacity: 0.7,
                        }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
