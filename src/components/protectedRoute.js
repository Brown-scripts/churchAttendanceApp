import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext"; // Create an Auth Context for state management

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();

  return user ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
