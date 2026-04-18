import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import logo from "../assets/image.png";

const features = [
  { num: "01", title: "Bulk attendance in one tap",  body: "Mark dozens of members present at once. Sort by category. Already-present members are skipped automatically." },
  { num: "02", title: "Streaks that make sense",      body: "Sunday streaks and Monday streaks tracked separately. Missing one never breaks the other." },
  { num: "03", title: "Reports in two clicks",        body: "Monthly Word reports with narratives, stats, and signatures — pre-formatted and ready to share." },
  { num: "04", title: "Clean analytics",              body: "Filter by month, service type, or category. Trends, comparisons, and a per-service deep-dive." },
  { num: "05", title: "CSV in and out",               body: "Import your existing roster. Export streaks, reports, and raw data whenever you need them." },
  { num: "06", title: "Full audit trail",             body: "Every edit, add, remove, and bulk update is logged. Filter, search, paginate — accountability built in." },
];

const DashboardSlide = () => (
  <>
    <div className="preview-kpi-row">
      <div className="preview-kpi"><div className="preview-kpi-label">Total records</div><div className="preview-kpi-value">2,847</div></div>
      <div className="preview-kpi"><div className="preview-kpi-label">This month</div><div className="preview-kpi-value">412</div></div>
      <div className="preview-kpi"><div className="preview-kpi-label">Members</div><div className="preview-kpi-value">189</div></div>
    </div>
    <div className="preview-chart">
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="preview-svg">
        <defs>
          <linearGradient id="pvGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,90 L40,70 L80,80 L120,55 L160,60 L200,35 L240,45 L280,25 L320,30 L360,15 L400,20 L400,120 L0,120 Z" fill="url(#pvGrad)" />
        <path d="M0,90 L40,70 L80,80 L120,55 L160,60 L200,35 L240,45 L280,25 L320,30 L360,15 L400,20" fill="none" stroke="#26a69a" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
    <div className="preview-rows">
      <div className="preview-row"><span>Sunday Service</span><span className="preview-row-bar"><i style={{width:"85%"}} /></span><span>85%</span></div>
      <div className="preview-row"><span>Monday Service</span><span className="preview-row-bar"><i style={{width:"62%"}} /></span><span>62%</span></div>
      <div className="preview-row"><span>Special</span><span className="preview-row-bar"><i style={{width:"34%"}} /></span><span>34%</span></div>
    </div>
  </>
);

const AttendanceSlide = () => (
  <>
    <div className="mock-field-row">
      <div className="mock-field">
        <div className="mock-field-label">Service</div>
        <div className="mock-field-value">Sunday Service</div>
      </div>
      <div className="mock-field">
        <div className="mock-field-label">Date</div>
        <div className="mock-field-value">Mar 17, 2026</div>
      </div>
    </div>
    <div className="mock-group-box">
      <div className="mock-group-head">
        <span className="mock-check-sq on" />
        <strong>L100</strong>
        <span className="mock-meta">15 members · 3 selected</span>
        <span className="mock-chev">▼</span>
      </div>
      <div className="mock-check-list">
        <div className="mock-check-row"><span className="mock-check on" />Akosua Mensah<span className="mock-pill">Present</span></div>
        <div className="mock-check-row selected"><span className="mock-check on" />Kwame Asante</div>
        <div className="mock-check-row"><span className="mock-check" />Nana Yaa Boateng</div>
      </div>
    </div>
    <button className="mock-primary-btn">Mark 18 Present</button>
  </>
);

const StreaksSlide = () => (
  <>
    <div className="mock-streak-table">
      <div className="mock-streak-groups">
        <div className="mock-streak-group sunday">Sunday</div>
        <div className="mock-streak-group monday">Monday</div>
      </div>
      <div className="mock-streak-head">
        <span>#</span><span>Member</span><span>Cur</span><span>Lng</span><span>Cur</span><span>Lng</span>
      </div>
      <div className="mock-streak-row"><span>🥇</span><span>Kwame A.</span><span className="hot">🔥 14</span><span>26</span><span className="hot">🔥 9</span><span>18</span></div>
      <div className="mock-streak-row"><span>🥈</span><span>Akosua M.</span><span className="hot">🔥 12</span><span>22</span><span>8</span><span>15</span></div>
      <div className="mock-streak-row"><span>🥉</span><span>Kojo A.</span><span className="hot">🔥 11</span><span>19</span><span>7</span><span>13</span></div>
      <div className="mock-streak-row"><span>4.</span><span>Yaa B.</span><span>9</span><span>17</span><span className="hot">🔥 6</span><span>11</span></div>
    </div>
  </>
);

const AnalyticsSlide = () => (
  <>
    <div className="preview-kpi-row">
      <div className="preview-kpi"><div className="preview-kpi-label">Avg / session</div><div className="preview-kpi-value">47</div></div>
      <div className="preview-kpi"><div className="preview-kpi-label">Sun / Mon</div><div className="preview-kpi-value">312<span style={{ color: "rgba(255,255,255,0.3)", margin: "0 0.25rem" }}>/</span>100</div></div>
      <div className="preview-kpi"><div className="preview-kpi-label">Growth</div><div className="preview-kpi-value" style={{ color: "#4ade80" }}>↑ 18%</div></div>
    </div>
    <div className="preview-chart">
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="preview-svg">
        <path d="M0,85 L40,70 L80,75 L120,52 L160,58 L200,38 L240,45 L280,25 L320,32 L360,18 L400,22" fill="none" stroke="#26a69a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M0,100 L40,92 L80,88 L120,78 L160,82 L200,68 L240,72 L280,60 L320,64 L360,52 L400,50" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
    <div className="mock-legend">
      <span><i style={{ background: "#26a69a" }} /> Sunday</span>
      <span><i style={{ background: "#7c3aed" }} /> Monday</span>
    </div>
  </>
);

const previewSlides = [
  { title: "urf-zone1.app / dashboard",  body: <DashboardSlide /> },
  { title: "urf-zone1.app / attendance", body: <AttendanceSlide /> },
  { title: "urf-zone1.app / streaks",    body: <StreaksSlide /> },
  { title: "urf-zone1.app / analytics",  body: <AnalyticsSlide /> },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-advance preview slides
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % previewSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-v2">
      <header className={`landing-nav ${scrollY > 20 ? "scrolled" : ""}`}>
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <img src={logo} alt="" className="landing-nav-logo" />
            <span>URF Zone 1</span>
          </div>
          <button className="landing-nav-signin" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </header>

      <section className="landing-hero-v2">
        <div className="landing-hero-inner">
          <div className="landing-badge">
            <span className="landing-badge-dot" /> Attendance platform
          </div>
          <h1 className="landing-h1">
            Every member.<br />
            Every service.<br />
            <span className="landing-h1-accent">Tracked with care.</span>
          </h1>
          <p className="landing-sub">
            A dedicated attendance system for Universal Radiant Family — Zone 1.
            Record, analyze, and celebrate the people who show up week after week.
          </p>
          <div className="landing-cta-row">
            <button className="landing-primary-btn" onClick={() => navigate("/login")}>
              Sign in to continue
            </button>
            <a href="#features" className="landing-ghost-btn">
              Learn more →
            </a>
          </div>

        </div>

        {/* Auto-cycling preview card */}
        <div className="landing-preview">
          <div className="landing-preview-frame">
            <div className="landing-preview-header">
              <span className="landing-preview-dot red" />
              <span className="landing-preview-dot amber" />
              <span className="landing-preview-dot green" />
              <div className="landing-preview-url preview-url-cycle">
                {previewSlides[activeSlide].title}
              </div>
            </div>
            <div className="landing-preview-body preview-stack">
              {previewSlides.map((slide, i) => (
                <div
                  key={i}
                  className={`preview-slide ${i === activeSlide ? "active" : ""}`}
                  aria-hidden={i !== activeSlide}
                >
                  {slide.body}
                </div>
              ))}
            </div>
            {/* Slide indicator dots */}
            <div className="preview-indicators">
              {previewSlides.map((_, i) => (
                <button
                  key={i}
                  className={`preview-indicator ${i === activeSlide ? "active" : ""}`}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`Show slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Static features grid */}
      <section id="features" className="landing-features-v2">
        <div className="landing-section-inner">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">What's inside</span>
            <h2>Built for the way the church actually works</h2>
          </div>
          <div className="landing-feature-grid">
            {features.map(f => (
              <div key={f.num} className="landing-feature">
                <div className="landing-feature-num">{f.num}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-section-inner landing-final-inner">
          <h2>Ready to take attendance seriously?</h2>
          <p>Sign in with your approved email to get started.</p>
          <button className="landing-primary-btn large" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </section>

      <footer className="landing-footer-v2">
        <span>&copy; {new Date().getFullYear()} URF Zone 1</span>
        <span className="landing-footer-sep">·</span>
        <span>Attendance Management System</span>
      </footer>
    </div>
  );
}
