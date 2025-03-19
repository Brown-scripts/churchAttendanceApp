import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Attendance from "./pages/attendance";
import AnalyticsPage from "./pages/analytics";
import DetailedAnalytics from "./pages/detailedAnalytics"; // Import detailed analytics page
import "./styles.css";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/analytics/:serviceName" element={<DetailedAnalytics />} /> {/* Route for detailed analytics */}
      </Routes>
    </Router>
  );
}
