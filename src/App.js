import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./context/authContext";
import Home from "./pages/home";
import Attendance from "./pages/attendance";
import AnalyticsPage from "./pages/analytics";
import DetailedAnalytics from "./pages/detailedAnalytics";
import Membership from "./pages/membership";
import Logs from "./pages/logs";
import AdminDashboard from "./pages/adminDashboard";
import Landing from "./pages/landing";
import Auth from "./components/auth";
import ProtectedRoute from "./components/protectedRoute";
import { ToastProvider } from "./components/Toast";
import { ConfirmProvider } from "./components/ConfirmDialog";
import "./styles.css";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
        <ConfirmProvider>
        <Router>
      {/* Navigation Bar (always visible except on login) */}
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/welcome" element={<Landing />} />
        <Route
          path="/*"
          element={
            <>
              <Routes>
                <Route
                  path="/"
                  element={<ProtectedRoute redirectTo="/welcome"><Home /></ProtectedRoute>}
                />
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
                <Route
                  path="/membership"
                  element={<ProtectedRoute><Membership /></ProtectedRoute>}
                />
                <Route
                  path="/logs"
                  element={<ProtectedRoute><Logs /></ProtectedRoute>}
                />
                <Route
                  path="/admin"
                  element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>}
                />
              </Routes>
            </>
          }
        />
      </Routes>
        </Router>
        </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
