import React from "react";
import { useAuth } from "../context/authContext";

// Component to show content only to admins
export const AdminOnly = ({ children, fallback = null }) => {
  const { isAdmin, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }
  
  return isAdmin() ? children : fallback;
};

// Component to show content only to regular users
export const UserOnly = ({ children, fallback = null }) => {
  const { isUser, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }
  
  return isUser() ? children : fallback;
};

// Component to show content based on specific role
export const RoleRequired = ({ role, children, fallback = null }) => {
  const { hasRole, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }
  
  return hasRole(role) ? children : fallback;
};

// Component to show content to authenticated users with any role
export const AuthenticatedOnly = ({ children, fallback = null }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-spinner">Loading...</div>;
  }
  
  return (user && userRole) ? children : fallback;
};

// Higher-order component for role-based access
export const withRoleAccess = (WrappedComponent, requiredRole) => {
  return (props) => {
    const { hasRole, loading, user, userRole } = useAuth();
    
    if (loading) {
      return (
        <div className="page-content">
          <div className="loading-container">
            <div className="loading-spinner">Loading...</div>
            <p>Checking permissions...</p>
          </div>
        </div>
      );
    }
    
    if (!user || !userRole) {
      return (
        <div className="page-content">
          <div className="error-container">
            <h2>Access Denied</h2>
            <p>You need to be logged in to access this page.</p>
          </div>
        </div>
      );
    }
    
    if (!hasRole(requiredRole)) {
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
    
    return <WrappedComponent {...props} />;
  };
};

// Hook for role-based conditional rendering
export const useRoleAccess = () => {
  const { user, userRole, isAdmin, isUser, hasRole, loading } = useAuth();
  
  return {
    user,
    userRole,
    isAdmin: isAdmin(),
    isUser: isUser(),
    hasRole,
    loading,
    canAccess: (role) => hasRole(role),
    isAuthenticated: !!(user && userRole)
  };
};
