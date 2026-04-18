import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  // Map: email (lowercased) → displayName
  const [displayNameMap, setDisplayNameMap] = useState({});

  // Load all allowedUsers once to build the display-name lookup
  const loadDisplayNames = async () => {
    try {
      const snap = await getDocs(collection(db, "allowedUsers"));
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.email) map[data.email.toLowerCase()] = data.displayName || null;
      });
      setDisplayNameMap(map);
    } catch (err) {
      console.error("Error loading display names:", err);
    }
  };

  // Function to fetch user role from Firebase
  const fetchUserRole = async (email) => {
    try {
      const q = query(
        collection(db, "allowedUsers"),
        where("email", "==", email.toLowerCase())
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        return userData.role || "user";
      }
      return null;
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        const role = await fetchUserRole(currentUser.email);
        setUserRole(role);
        loadDisplayNames();
      } else {
        setUserRole(null);
        setDisplayNameMap({});
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper functions for role checking
  const isAdmin = () => userRole === "admin";
  const isUser = () => userRole === "user";
  const hasRole = (role) => userRole === role;

  // Resolve an email to a display name, falling back to the part before @
  const displayNameFor = (email) => {
    if (!email) return "System";
    const key = email.toLowerCase();
    return displayNameMap[key] || email.split("@")[0];
  };

  const value = {
    user,
    userRole,
    loading,
    isAdmin,
    isUser,
    hasRole,
    displayNameFor,
    refreshDisplayNames: loadDisplayNames,
    refreshUserRole: async () => {
      if (user) {
        const role = await fetchUserRole(user.email);
        setUserRole(role);
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
