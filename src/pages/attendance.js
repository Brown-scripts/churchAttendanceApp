import React, { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../context/authContext";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";

export default function AttendanceForm({ fetchAttendance }) {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isNewMember, setIsNewMember] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState("");
  const [existingServices, setExistingServices] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [user, setUser] = useState(null);
  const { isAdmin } = useAuth();

  const navigate = useNavigate();
  const auth = getAuth();



  // Check user authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "membership"));
        const list = snapshot.docs.map((doc) => doc.data());
        setMembers(list);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        const serviceSet = new Set();
        snapshot.forEach((doc) => serviceSet.add(doc.data().serviceName));
        setExistingServices([...serviceSet]);
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    const match = members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      setIsNewMember(false);
      setCategory(match.category);
    } else if (name.trim() && isAdmin()) {
      // Only admins can add new members
      setIsNewMember(true);
      setCategory(""); // Let admin pick
    } else if (name.trim() && !isAdmin()) {
      // Non-admins can only select existing members
      setIsNewMember(false);
      setCategory("");
    }
  }, [name, members, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalName = name.trim();
    const finalCategory = category;
    const finalService = serviceName.trim();

    if (!finalName || !finalCategory || !finalService || !date) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      // Check for case-insensitive duplicate attendance
      const attendanceRef = collection(db, "attendance");
      const duplicateQuery = query(
        attendanceRef,
        where("serviceName", "==", finalService),
        where("date", "==", date)
      );

      const duplicateSnap = await getDocs(duplicateQuery);
      const normalizedName = finalName.toLowerCase().trim();

      const isDuplicate = duplicateSnap.docs.some(doc => {
        const existingName = doc.data().name.toLowerCase().trim();
        return existingName === normalizedName;
      });

      if (isDuplicate) {
        alert(`Attendance already recorded for "${finalName}" in ${finalService} service on ${date}.`);
        return;
      }

      // Only admins can add new members
      if (isNewMember && isAdmin()) {
        await addDoc(collection(db, "membership"), {
          name: finalName,
          category: finalCategory,
        });
      } else if (isNewMember && !isAdmin()) {
        alert("Only administrators can add new members. Please select from existing members.");
        return;
      }

      await addDoc(collection(db, "attendance"), {
        name: finalName,
        category: finalCategory,
        serviceName: finalService,
        date,
        timestamp: serverTimestamp(),
      });

      // Log the attendance addition
      await addDoc(collection(db, "logs"), {
        action: "Attendance Added",
        details: `Added attendance for ${finalName} in ${finalService} service on ${date}`,
        user: "System", // You can get the current user if needed
        timestamp: serverTimestamp(),
        memberName: finalName,
        serviceName: finalService,
        date: date
      });

      setName("");
      setCategory("");
      setServiceName("");
      setIsNewMember(false);
      setSuccessMessage("Attendance submitted successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);

      await fetchAttendance?.();
    } catch (err) {
      console.error("Error submitting attendance:", err);
      alert(`❌ Submission failed: ${err.message}`);
    }
  };

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="attendance-container">
          {/* Page Header */}
          <div className="page-header-clean">
            <h1>Attendance Management</h1>
            <p>Record member attendance for services and events</p>
          </div>

      {/* Success Message */}
      {successMessage && (
        <div className="success-banner">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="success-close">×</button>
        </div>
      )}

      {/* Modern Form Container */}
      <div className="form-container">
        <form onSubmit={handleSubmit} className="attendance-form">
        {/* Role-based access notice */}
        {!isAdmin() && (
          <div className="info-banner">
            <span>ℹ️ You can only select from existing members. Contact an admin to add new members.</span>
          </div>
        )}

        {/* Name Input with Suggestions */}
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Name {!isAdmin() && <span className="text-muted">(Select from existing members only)</span>}
          </label>
          {isAdmin() ? (
            <input
              list="member-options"
              id="name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type or select member name..."
              required
            />
          ) : (
            <select
              id="name"
              className="form-select"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            >
              <option value="">Select a member...</option>
              {members.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <datalist id="member-options">
            {members.map((m) => (
              <option key={m.name} value={m.name} />
            ))}
          </datalist>
        </div>

        {/* Category Input */}
        {isNewMember && isAdmin() ? (
          <AdminOnly>
            <div className="form-group">
              <label htmlFor="new-category" className="form-label">
                Category <span className="text-muted">(Admin: New Member)</span>
              </label>
              <select
                id="new-category"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select Category</option>
                <option value="L100">L100</option>
                <option value="L200">L200</option>
                <option value="L300">L300</option>
                <option value="L400">L400</option>
                <option value="Worker">Worker</option>
                <option value="Other">Other</option>
                <option value="New">New Member</option>
              </select>
            </div>
          </AdminOnly>
        ) : (
          <div className="form-group">
            <label htmlFor="category" className="form-label">
              Category
            </label>
            <input
              id="category"
              className="form-input readonly"
              type="text"
              value={category}
              readOnly
              placeholder="Category will auto-fill"
            />
          </div>
        )}

        {/* Service Input with Suggestions */}
        <div className="form-group">
          <label htmlFor="service">Service</label>
          <input
            list="service-options"
            id="service"
            className="form-input"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="Type or select service"
            required
          />
          <datalist id="service-options">
            {existingServices.map((srv) => (
              <option key={srv} value={srv} />
            ))}
          </datalist>
        </div>

        {/* Date Picker */}
        <div className="form-group">
          <label htmlFor="date" className="form-label">Date</label>
          <input
            id="date"
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Submit Button */}
        <button type="submit" className="submit-btn">
          Submit Attendance
        </button>
      </form>

      
      {/* Floating Quick Access Menu */}
      <div className="floating-quick-menu">
        <div className="quick-menu-item" onClick={() => navigate('/')} title="Home">
          <span className="menu-icon">🏠</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/analytics')} title="Analytics">
          <span className="menu-icon">📊</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/membership')} title="Membership">
          <span className="menu-icon">👥</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/logs')} title="Audit Logs">
          <span className="menu-icon">📋</span>
        </div>
        <AdminOnly>
          <div className="quick-menu-item" onClick={() => navigate('/admin')} title="Admin Dashboard">
            <span className="menu-icon">⚙️</span>
          </div>
        </AdminOnly>
      </div>

      </div>
        </div>
      </div>
    </>
  );
}
