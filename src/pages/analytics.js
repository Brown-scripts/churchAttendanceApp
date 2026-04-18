import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Navigation from "../components/Navigation";
import AnalyticsComponent, { LineChart } from "../components/analytics";
import { getServiceType } from "../utils/serviceType";

const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#f97316","#84cc16","#ec4899","#6366f1",
  "#14b8a6","#f43f5e",
];

const CATEGORY_COLORS = {
  L100: "#3b82f6",
  L200: "#10b981",
  L300: "#f59e0b",
  L400: "#8b5cf6",
  WORKER: "#ef4444",
  OTHER: "#64748b",
  NEW: "#ec4899",
};

const categoryColor = (cat) => CATEGORY_COLORS[cat?.toUpperCase()] || "#64748b";

export default function Analytics() {
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceTypeFilter, setServiceTypeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [activeSection, setActiveSection] = useState("overview"); // overview | services | categories
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
        const rows = snap.docs.map(d => {
          const data = d.data();
          return {
            serviceName: data.serviceName,
            category: data.category,
            date: data.date,
            serviceType: getServiceType(data),
          };
        });
        setRecords(rows);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set();
    records.forEach(r => { if (r.date) set.add(r.date.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [records]);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (serviceTypeFilter !== "All" && r.serviceType !== serviceTypeFilter) return false;
      if (monthFilter !== "All" && !r.date?.startsWith(monthFilter)) return false;
      return true;
    });
  }, [records, serviceTypeFilter, monthFilter]);

  // Previous-period records (for growth KPI)
  const previousPeriodFiltered = useMemo(() => {
    if (monthFilter === "All") return null;
    const [y, m] = monthFilter.split("-").map(Number);
    const prevMonthDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    return records.filter(r => {
      if (serviceTypeFilter !== "All" && r.serviceType !== serviceTypeFilter) return false;
      return r.date?.startsWith(prevMonth);
    });
  }, [records, serviceTypeFilter, monthFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRecords = filtered.length;
    const uniqueServices = new Set(filtered.map(r => r.serviceName)).size;
    const uniqueDates = new Set(filtered.map(r => r.date)).size;
    const avgPerService = uniqueDates > 0 ? Math.round(totalRecords / uniqueDates) : 0;

    const activeMembers = new Set(filtered.map(r => r.category + "|" + r.serviceName)).size;

    let growthPct = null;
    if (previousPeriodFiltered && previousPeriodFiltered.length > 0) {
      growthPct = Math.round(((totalRecords - previousPeriodFiltered.length) / previousPeriodFiltered.length) * 100);
    } else if (previousPeriodFiltered && previousPeriodFiltered.length === 0 && totalRecords > 0) {
      growthPct = 100;
    }

    return { totalRecords, uniqueServices, uniqueMembers: uniqueDates, avgPerService, activeMembers, growthPct };
  }, [filtered, previousPeriodFiltered]);

  // Service aggregation
  const serviceData = useMemo(() => {
    const svc = {};
    filtered.forEach(r => {
      if (!svc[r.serviceName]) svc[r.serviceName] = { total: 0, categories: {}, dates: new Set() };
      svc[r.serviceName].total += 1;
      svc[r.serviceName].categories[r.category] = (svc[r.serviceName].categories[r.category] || 0) + 1;
      if (r.date) svc[r.serviceName].dates.add(r.date);
    });
    return svc;
  }, [filtered]);

  const sortedServices = useMemo(() => {
    return Object.keys(serviceData).sort((a, b) => serviceData[b].total - serviceData[a].total);
  }, [serviceData]);

  // Sunday vs Monday daily trend — two lines
  const trendData = useMemo(() => {
    const sunByDate = {};
    const monByDate = {};
    filtered.forEach(r => {
      if (!r.date) return;
      if (r.serviceType === "Sunday") sunByDate[r.date] = (sunByDate[r.date] || 0) + 1;
      else if (r.serviceType === "Monday") monByDate[r.date] = (monByDate[r.date] || 0) + 1;
    });
    const allDates = Array.from(new Set([...Object.keys(sunByDate), ...Object.keys(monByDate)])).sort();
    return {
      labels: allDates,
      datasets: [
        {
          label: "Sunday",
          data: allDates.map(d => sunByDate[d] || null),
          borderColor: "#26a69a",
          backgroundColor: "rgba(38,166,154,0.12)",
          tension: 0.35,
          pointRadius: 3,
          fill: serviceTypeFilter === "Sunday",
          spanGaps: true,
        },
        {
          label: "Monday",
          data: allDates.map(d => monByDate[d] || null),
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.12)",
          tension: 0.35,
          pointRadius: 3,
          fill: serviceTypeFilter === "Monday",
          spanGaps: true,
        },
      ],
    };
  }, [filtered, serviceTypeFilter]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap = {};
    filtered.forEach(r => {
      const key = (r.category || "Other").toUpperCase();
      catMap[key] = (catMap[key] || 0) + 1;
    });
    return catMap;
  }, [filtered]);

  const categoryChartData = useMemo(() => {
    const labels = Object.keys(categoryBreakdown);
    return {
      labels,
      datasets: [{
        label: "By Category",
        data: labels.map(l => categoryBreakdown[l]),
        backgroundColor: labels.map(l => categoryColor(l)),
        borderColor: labels.map(l => categoryColor(l)),
        borderWidth: 2,
      }],
    };
  }, [categoryBreakdown]);

  // Date-based bar chart (attendance per date)
  const dateBarData = useMemo(() => {
    const byDate = {};
    filtered.forEach(r => {
      if (!r.date) return;
      byDate[r.date] = (byDate[r.date] || 0) + 1;
    });
    const dates = Object.keys(byDate).sort();
    return {
      labels: dates,
      datasets: [{
        label: "Attendance",
        data: dates.map(d => byDate[d]),
        backgroundColor: dates.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: dates.map((_, i) => COLORS[i % COLORS.length]),
        borderWidth: 2,
      }],
    };
  }, [filtered]);


  // Service comparison: current vs previous period
  const serviceComparison = useMemo(() => {
    if (!previousPeriodFiltered) return null;
    const prevMap = {};
    previousPeriodFiltered.forEach(r => {
      prevMap[r.serviceName] = (prevMap[r.serviceName] || 0) + 1;
    });
    return sortedServices.slice(0, 15).map(name => {
      const curr = serviceData[name].total;
      const prev = prevMap[name] || 0;
      const change = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
      return { name, curr, prev, change };
    });
  }, [sortedServices, serviceData, previousPeriodFiltered]);

  // Calendar heatmap (selected month only)
  const heatmapData = useMemo(() => {
    if (monthFilter === "All") return null;
    const [y, m] = monthFilter.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay();
    const countByDay = {};
    filtered.forEach(r => {
      if (!r.date?.startsWith(monthFilter)) return;
      const day = parseInt(r.date.split("-")[2], 10);
      countByDay[day] = (countByDay[day] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(countByDay));
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const count = countByDay[d] || 0;
      cells.push({ day: d, count, intensity: count / max });
    }
    return { cells, max, monthLabel: new Date(y, m - 1, 1).toLocaleDateString("default", { month: "long", year: "numeric" }) };
  }, [filtered, monthFilter]);

  const totalAttendance = filtered.length;

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="loading-spinner"><div className="spinner" /><p>Loading analytics...</p></div>
          </div>
        </div>
      </>
    );
  }

  if (!records.length) {
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

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="analytics-container">

          <div className="page-header-clean">
            <h1>Analytics</h1>
            <p>
              {totalAttendance.toLocaleString()} records · {sortedServices.length} service{sortedServices.length !== 1 ? "s" : ""}
              {monthFilter !== "All" && ` · ${new Date(monthFilter + "-01").toLocaleDateString("default", { month: "long", year: "numeric" })}`}
            </p>
          </div>

          {/* KPI Row */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Total Records</div>
              <div className="kpi-value">{kpis.totalRecords.toLocaleString()}</div>
              <div className="kpi-sub">{kpis.uniqueServices} services</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg / Session</div>
              <div className="kpi-value">{kpis.avgPerService}</div>
              <div className="kpi-sub">{kpis.uniqueMembers} session{kpis.uniqueMembers !== 1 ? "s" : ""}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Sunday vs Monday</div>
              <div className="kpi-value">
                {filtered.filter(r => r.serviceType === "Sunday").length}
                <span className="kpi-divider">/</span>
                {filtered.filter(r => r.serviceType === "Monday").length}
              </div>
              <div className="kpi-sub">records</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Growth vs Prev</div>
              <div className={`kpi-value ${kpis.growthPct > 0 ? "kpi-up" : kpis.growthPct < 0 ? "kpi-down" : ""}`}>
                {kpis.growthPct === null ? "—" : `${kpis.growthPct > 0 ? "↑" : kpis.growthPct < 0 ? "↓" : ""} ${Math.abs(kpis.growthPct)}%`}
              </div>
              <div className="kpi-sub">{monthFilter === "All" ? "select a month" : "vs last month"}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="controls-card">
            <div className="controls-header">
              <h3>Filters</h3>
            </div>
            <div className="controls-grid">
              <div className="control-group">
                <label>Service Type</label>
                <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className="select-clean">
                  <option value="All">All Types</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                </select>
              </div>
              <div className="control-group">
                <label>Month</label>
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="select-clean">
                  <option value="All">All Time</option>
                  {availableMonths.map(m => {
                    const label = new Date(m + "-01").toLocaleDateString("default", { month: "long", year: "numeric" });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="attendance-tabs analytics-section-tabs">
            <button
              className={`tab-btn ${activeSection === "overview" ? "tab-active" : ""}`}
              onClick={() => setActiveSection("overview")}
            >Overview</button>
            <button
              className={`tab-btn ${activeSection === "services" ? "tab-active" : ""}`}
              onClick={() => setActiveSection("services")}
            >Services</button>
            <button
              className={`tab-btn ${activeSection === "categories" ? "tab-active" : ""}`}
              onClick={() => setActiveSection("categories")}
            >Categories</button>
          </div>

          {/* OVERVIEW SECTION */}
          {activeSection === "overview" && (
            <>
              {/* Trend line chart (Sunday vs Monday) */}
              {trendData.labels.length > 0 && (
                <div className="chart-container">
                  <div className="table-header">
                    <h3>Attendance Trend</h3>
                    <span className="table-info">{trendData.labels.length} dates · Sunday vs Monday</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <LineChart chartData={trendData} height={280} />
                  </div>
                </div>
              )}

              {/* Heatmap calendar */}
              {heatmapData && (
                <div className="chart-container">
                  <div className="table-header">
                    <h3>Calendar Heatmap</h3>
                    <span className="table-info">{heatmapData.monthLabel} · max {heatmapData.max} / day</span>
                  </div>
                  <div className="heatmap-body">
                    <div className="heatmap-weekdays">
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span>
                      <span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>
                    <div className="heatmap-grid">
                      {heatmapData.cells.map((c, i) => (
                        c.blank ? (
                          <div key={i} className="heatmap-cell heatmap-blank" />
                        ) : (
                          <div
                            key={i}
                            className={`heatmap-cell ${c.count > 0 ? "has-data" : ""}`}
                            style={c.count > 0 ? { backgroundColor: `rgba(38,166,154,${0.15 + c.intensity * 0.75})` } : undefined}
                            title={`Day ${c.day}: ${c.count} records`}
                          >
                            <span className="heatmap-day">{c.day}</span>
                            {c.count > 0 && <span className="heatmap-count">{c.count}</span>}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* SERVICES SECTION */}
          {activeSection === "services" && (
            <>
              {dateBarData.labels.length > 0 && (
                <div className="chart-container">
                  <div className="table-header">
                    <h3>Attendance by Date</h3>
                    <span className="table-info">{dateBarData.labels.length} date{dateBarData.labels.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <AnalyticsComponent chartData={dateBarData} />
                  </div>
                </div>
              )}

              {/* Service comparison table */}
              {serviceComparison && serviceComparison.length > 0 && (
                <div className="table-card">
                  <div className="table-header">
                    <h3>Service Comparison</h3>
                    <span className="table-info">This month vs previous</span>
                  </div>
                  <div className="table-container-clean">
                    <table className="members-table-clean">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th style={{ textAlign: "center" }}>Current</th>
                          <th style={{ textAlign: "center" }}>Previous</th>
                          <th style={{ textAlign: "center" }}>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceComparison.map(s => (
                          <tr key={s.name}>
                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                            <td style={{ textAlign: "center", fontWeight: 700 }}>{s.curr}</td>
                            <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{s.prev}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`trend-pill ${s.change > 0 ? "trend-up" : s.change < 0 ? "trend-down" : "trend-flat"}`}>
                                {s.change > 0 ? "↑" : s.change < 0 ? "↓" : "—"} {Math.abs(s.change)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="services-section">
                <h3>All Services — click to view breakdown</h3>
                <div className="service-list">
                  {sortedServices.map((service, i) => {
                    const data = serviceData[service];
                    const pct = totalAttendance > 0 ? Math.round((data.total / totalAttendance) * 100) : 0;
                    return (
                      <button
                        key={service}
                        className="service-button"
                        onClick={() => navigate(`/analytics/${encodeURIComponent(service)}`)}
                      >
                        <div className="service-button-header">
                          <div className="service-color-dot" style={{ background: COLORS[i % COLORS.length] }} />
                          <div className="service-name">{service}</div>
                        </div>
                        <div className="service-count">{data.total.toLocaleString()} records · {pct}% of total</div>
                        <div className="service-mini-bar">
                          {Object.values(data.categories).map((v, ci) => (
                            <div key={ci} className="service-mini-segment" style={{ flex: v, background: COLORS[ci % COLORS.length] }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* CATEGORIES SECTION */}
          {activeSection === "categories" && (
            <>
              {categoryChartData.labels.length > 0 && (
                <div className="chart-container">
                  <div className="table-header">
                    <h3>Category Distribution</h3>
                    <span className="table-info">{categoryChartData.labels.length} categories</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <AnalyticsComponent chartData={categoryChartData} />
                  </div>
                </div>
              )}

              <div className="category-cards-grid">
                {Object.entries(categoryBreakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([cat, count]) => {
                    const pct = totalAttendance > 0 ? Math.round((count / totalAttendance) * 100) : 0;
                    return (
                      <div key={cat} className="category-stat-card" style={{ borderTopColor: categoryColor(cat) }}>
                        <div className="category-stat-label">{cat}</div>
                        <div className="category-stat-value">{count}</div>
                        <div className="category-stat-pct">{pct}% of total</div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
