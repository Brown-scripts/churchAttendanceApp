import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Navigation from "../components/Navigation";
import AnalyticsComponent, { LineChart, BarChart } from "../components/analytics";
import { getServiceType } from "../utils/serviceType";
import { useAttendanceRecords } from "../hooks/useFirestoreCollection";
import { useToast } from "../components/Toast";
import { Download } from "lucide-react";
import { SkeletonKpiRow, SkeletonChart } from "../components/Skeleton";

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
  const [user, setUser] = useState(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [activeSection, setActiveSection] = useState("overview"); // overview | services | categories
  const navigate = useNavigate();
  const auth = getAuth();
  const toast = useToast();

  const { data: rawRecords, loading } = useAttendanceRecords();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  const records = useMemo(() => {
    if (!rawRecords) return [];
    return rawRecords.map(data => ({
      serviceName: data.serviceName,
      category: data.category,
      date: data.date,
      serviceType: getServiceType(data),
    }));
  }, [rawRecords]);

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
      if (!svc[r.serviceName]) svc[r.serviceName] = { total: 0, categories: {}, dates: new Set(), typeCounts: { Sunday: 0, Monday: 0 } };
      svc[r.serviceName].total += 1;
      svc[r.serviceName].categories[r.category] = (svc[r.serviceName].categories[r.category] || 0) + 1;
      if (r.date) svc[r.serviceName].dates.add(r.date);
      if (r.serviceType === "Sunday") svc[r.serviceName].typeCounts.Sunday++;
      else if (r.serviceType === "Monday") svc[r.serviceName].typeCounts.Monday++;
    });
    // Determine dominant type per service
    Object.values(svc).forEach(s => {
      s.dominantType = s.typeCounts.Sunday >= s.typeCounts.Monday ? "Sunday" : "Monday";
    });
    return svc;
  }, [filtered]);

  const sortedServices = useMemo(() => {
    return Object.keys(serviceData).sort((a, b) => serviceData[b].total - serviceData[a].total);
  }, [serviceData]);

  // Services table state
  const [serviceSort, setServiceSort] = useState({ field: "total", dir: "desc" });
  const toggleServiceSort = (field) => {
    setServiceSort(s => s.field === field ? { field, dir: s.dir === "desc" ? "asc" : "desc" } : { field, dir: "desc" });
  };

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

  const serviceTableRows = useMemo(() => {
    const rows = Object.entries(serviceData).map(([name, data]) => ({
      name,
      total: data.total,
      dates: data.dates.size,
      type: data.dominantType,
      pct: totalAttendance > 0 ? (data.total / totalAttendance) * 100 : 0,
    }));
    rows.sort((a, b) => {
      const av = a[serviceSort.field];
      const bv = b[serviceSort.field];
      if (typeof av === "string") {
        return serviceSort.dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return serviceSort.dir === "desc" ? bv - av : av - bv;
    });
    const maxTotal = Math.max(1, ...rows.map(r => r.total));
    return rows.map(r => ({ ...r, barPct: (r.total / maxTotal) * 100 }));
  }, [serviceData, serviceSort, totalAttendance]);

  const exportServicesCSV = () => {
    if (serviceTableRows.length === 0) {
      toast.info("No service data to export.");
      return;
    }
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Rank,Service,Type,Attendance,Percent,Dates";
    const lines = serviceTableRows.map((row, i) => [
      i + 1,
      escape(row.name),
      row.type,
      row.total,
      Math.round(row.pct),
      row.dates,
    ].join(","));

    const filterBits = [];
    if (serviceTypeFilter !== "All") filterBits.push(serviceTypeFilter);
    if (monthFilter !== "All") filterBits.push(monthFilter);
    const suffix = filterBits.length ? `_${filterBits.join("_")}` : "";
    const stamp = new Date().toISOString().split("T")[0];
    const filename = `Services${suffix}_${stamp}.csv`;

    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${serviceTableRows.length} services.`);
  };

  if (loading) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="page-header-clean">
              <h1>Analytics</h1>
              <p><span className="skeleton skeleton-line" style={{ width: "220px" }} /></p>
            </div>
            <SkeletonKpiRow count={4} />
            <SkeletonChart height={320} />
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
                <span className="kpi-arrow" aria-hidden="true">
                  {kpis.growthPct === null ? "" : kpis.growthPct > 0 ? "↑" : kpis.growthPct < 0 ? "↓" : ""}
                </span>
                {kpis.growthPct === null ? "—" : `${Math.abs(kpis.growthPct)}%`}
              </div>
              <div className="kpi-sub">{monthFilter === "All" ? "select a month" : "vs last month"}</div>
            </div>
          </div>

          {/* Filters — inline toolbar */}
          <div className="inline-toolbar" role="group" aria-label="Analytics filters">
            <label className="inline-toolbar-group">
              <span className="inline-toolbar-label">Type</span>
              <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className="select-clean">
                <option value="All">All</option>
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
              </select>
            </label>
            <label className="inline-toolbar-group">
              <span className="inline-toolbar-label">Month</span>
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="select-clean">
                <option value="All">All Time</option>
                {availableMonths.map(m => {
                  const label = new Date(m + "-01").toLocaleDateString("default", { month: "long", year: "numeric" });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </label>
            {(serviceTypeFilter !== "All" || monthFilter !== "All") && (
              <button
                type="button"
                className="refresh-btn-small"
                onClick={() => { setServiceTypeFilter("All"); setMonthFilter("All"); }}
              >
                Clear
              </button>
            )}
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
                    <LineChart chartData={trendData} height={280} exportName="attendance-trend" />
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
              {(() => {
                const hasBar = dateBarData.labels.length > 0;
                const hasComparison = serviceComparison && serviceComparison.length > 0;
                const useSplit = hasBar && hasComparison;

                const barBlock = hasBar && (
                  <div className="chart-container">
                    <div className="table-header">
                      <h3>Attendance by Date</h3>
                      <span className="table-info">{dateBarData.labels.length} date{dateBarData.labels.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ padding: "1.25rem" }}>
                      <BarChart chartData={dateBarData} height={320} exportName="attendance-by-date" />
                    </div>
                  </div>
                );

                const comparisonBlock = hasComparison && (
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
                              <td className="cell-num cell-bold">{s.curr}</td>
                              <td className="cell-num-muted">{s.prev}</td>
                              <td className="cell-center">
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
                );

                return useSplit ? (
                  <div className="analytics-split">{barBlock}{comparisonBlock}</div>
                ) : (
                  <>{barBlock}{comparisonBlock}</>
                );
              })()}

              <div className="table-card">
                <div className="table-header">
                  <div className="table-header-left">
                    <h3>All Services</h3>
                    <span className="table-info">
                      {serviceTableRows.length} services
                      <span className="edit-hint"> — click a row for breakdown</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="refresh-btn-small"
                    onClick={exportServicesCSV}
                    disabled={serviceTableRows.length === 0}
                    aria-label="Export services as CSV"
                  >
                    <Download size={12} strokeWidth={2.5} className="icon-inline" style={{ marginRight: '0.3rem' }} />
                    Export CSV
                  </button>
                </div>
                <div className="table-container-clean">
                  <table className="members-table-clean services-table">
                    <thead>
                      <tr>
                        <th className="cell-center" style={{ width: "3rem" }}>#</th>
                        <th
                          className={`sortable-header ${serviceSort.field === "name" ? "sorted-active" : ""}`}
                          onClick={() => toggleServiceSort("name")}
                          style={{ cursor: "pointer" }}
                        >
                          Service {serviceSort.field === "name" && <span style={{ color: "var(--accent)" }}>{serviceSort.dir === "desc" ? "▼" : "▲"}</span>}
                        </th>
                        <th
                          className={`sortable-header ${serviceSort.field === "type" ? "sorted-active" : ""}`}
                          onClick={() => toggleServiceSort("type")}
                          style={{ cursor: "pointer", textAlign: "center" }}
                        >
                          Type {serviceSort.field === "type" && <span style={{ color: "var(--accent)" }}>{serviceSort.dir === "desc" ? "▼" : "▲"}</span>}
                        </th>
                        <th
                          className={`sortable-header ${serviceSort.field === "total" ? "sorted-active" : ""}`}
                          onClick={() => toggleServiceSort("total")}
                          style={{ cursor: "pointer", minWidth: "200px" }}
                        >
                          Attendance {serviceSort.field === "total" && <span style={{ color: "var(--accent)" }}>{serviceSort.dir === "desc" ? "▼" : "▲"}</span>}
                        </th>
                        <th
                          className={`sortable-header ${serviceSort.field === "pct" ? "sorted-active" : ""}`}
                          onClick={() => toggleServiceSort("pct")}
                          style={{ cursor: "pointer", textAlign: "center" }}
                        >
                          % {serviceSort.field === "pct" && <span style={{ color: "var(--accent)" }}>{serviceSort.dir === "desc" ? "▼" : "▲"}</span>}
                        </th>
                        <th
                          className={`sortable-header ${serviceSort.field === "dates" ? "sorted-active" : ""}`}
                          onClick={() => toggleServiceSort("dates")}
                          style={{ cursor: "pointer", textAlign: "center" }}
                        >
                          Dates {serviceSort.field === "dates" && <span style={{ color: "var(--accent)" }}>{serviceSort.dir === "desc" ? "▼" : "▲"}</span>}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceTableRows.map((row, i) => (
                        <tr
                          key={row.name}
                          className="clickable-row"
                          onClick={() => navigate(`/analytics/${encodeURIComponent(row.name)}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <td className="cell-num-muted" style={{ fontSize: "0.8rem" }}>{i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{row.name}</td>
                          <td className="cell-center">
                            <span className={`service-type-pill type-${row.type.toLowerCase()}`}>{row.type}</span>
                          </td>
                          <td>
                            <div className="attendance-bar-row">
                              <div className="attendance-bar">
                                <div
                                  className={`attendance-bar-fill type-${row.type.toLowerCase()}`}
                                  style={{ width: `${row.barPct}%` }}
                                />
                              </div>
                              <span className="attendance-bar-num">{row.total.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="cell-num-muted">{Math.round(row.pct)}%</td>
                          <td className="cell-num-muted">{row.dates}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* CATEGORIES SECTION */}
          {activeSection === "categories" && (() => {
            const hasPie = categoryChartData.labels.length > 0;
            const hasCards = Object.keys(categoryBreakdown).length > 0;

            const pieBlock = hasPie && (
              <div className="chart-container">
                <div className="table-header">
                  <h3>Category Distribution</h3>
                  <span className="table-info">{categoryChartData.labels.length} categories</span>
                </div>
                <div style={{ padding: "1.25rem" }}>
                  <AnalyticsComponent chartData={categoryChartData} exportName="category-distribution" />
                </div>
              </div>
            );

            const cardsBlock = hasCards && (
              <div className="category-stack">
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
            );

            return hasPie && hasCards ? (
              <div className="analytics-split">{pieBlock}{cardsBlock}</div>
            ) : (
              <>{pieBlock}{cardsBlock}</>
            );
          })()}

        </div>
      </div>
    </>
  );
}
