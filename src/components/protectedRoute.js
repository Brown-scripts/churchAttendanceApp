import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const ProtectedRoute = ({ children, requiredRole = null, adminOnly = false }) => {
  const { user, userRole, loading, hasRole, isAdmin } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-container">
          <div className="loading-spinner">Loading...</div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has a role assigned
  if (!userRole) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Access Pending</h2>
          <p>Your account is being reviewed. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Check admin-only access
  if (adminOnly && !isAdmin()) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Admin Access Required</h2>
          <p>This page is restricted to administrators only.</p>
        </div>
      </div>
    );
  }

  // Check specific role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Insufficient Permissions</h2>
          <p>You don't have the required permissions to access this page.</p>
          <p>Required role: <strong>{requiredRole}</strong></p>
          <p>Your role: <strong>{userRole}</strong></p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
