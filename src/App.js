import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Attendance from "./pages/attendance";
import AnalyticsPage from "./pages/analytics";
import DetailedAnalytics from "./pages/detailedAnalytics";
import Auth from "./pages/login";
import ProtectedRoute from "./components/protectedRoute";
import "./styles.css";

export default function App() {
  return (
    <Router>
      {/* Navigation Bar (always visible except on login) */}
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route 
          path="/*" 
          element={
            <>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route 
                  path="/attendance" 
                  element={<ProtectedRoute><Attendance /></ProtectedRoute>} 
                />
                <Route 
                  path="/analytics" 
                  element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} 
                />
                <Route 
                  path="/analytics/:serviceName" 
                  element={<ProtectedRoute><DetailedAnalytics /></ProtectedRoute>} 
                />
              </Routes>
            </>
          } 
        />
      </Routes>
    </Router>
  );
}
