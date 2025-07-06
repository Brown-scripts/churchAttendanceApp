import React, { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";

export default function AttendanceForm({ fetchAttendance }) {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [newName, setNewName] = useState("");
  const [isNewMember, setIsNewMember] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [customService, setCustomService] = useState("");
  const [date, setDate] = useState("");
  const [existingServices, setExistingServices] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        navigate("/login");
      })
      .catch((error) => {
        console.error("Logout failed:", error);
      });
  };

  // Set today's date on load
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  // Fetch members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const membershipCollection = collection(db, "membership");
        const snapshot = await getDocs(membershipCollection);
        const memberList = snapshot.docs.map((doc) => doc.data());
        setMembers(memberList);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
  }, []);

  // Fetch existing services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const attendanceCollection = collection(db, "attendance");
        const snapshot = await getDocs(attendanceCollection);
        const services = new Set();
        snapshot.forEach((doc) => services.add(doc.data().serviceName));
        setExistingServices([...services]);
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };
    fetchServices();
  }, []);

  // Update category based on selected name
  useEffect(() => {
    if (name === "Other") {
      setIsNewMember(true);
      setCategory("");
      setNewName("");
    } else {
      const match = members.find((m) => m.name === name);
      if (match) {
        setCategory(match.category);
        setIsNewMember(false);
        setNewName("");
      }
    }
  }, [name, members]);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalName = isNewMember ? newName.trim() : name;
    const finalCategory = category;
    const finalService =
      serviceName === "Other" ? customService.trim() : serviceName;

    if (!finalName || !finalCategory || !finalService || !date) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      // Prevent duplicate entries
      const attendanceRef = collection(db, "attendance");
      const duplicateQuery = query(
        attendanceRef,
        where("name", "==", finalName),
        where("serviceName", "==", finalService),
        where("date", "==", date)
      );

      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty) {
        alert("⚠️ Attendance already recorded for this member, service, and date.");
        return;
      }

      // Add new member if needed
      if (isNewMember) {
        await addDoc(collection(db, "membership"), {
          name: finalName,
          category: finalCategory,
        });
      }

      // Add attendance record
      await addDoc(collection(db, "attendance"), {
        name: finalName,
        category: finalCategory,
        serviceName: finalService,
        date,
      });

      // Reset form
      setName("");
      setNewName("");
      setCategory("");
      setIsNewMember(false);
      setServiceName("");
      setCustomService("");

      await fetchAttendance?.();

      setSuccessMessage("✅ Attendance submitted successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Error submitting attendance:", err);
      alert(`❌ Submission failed: ${err.message}`);
    }
  };

  return (
    <div className="form-container">
      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      <form onSubmit={handleSubmit} className="attendance-form">
        {/* Name Select */}
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <select
            id="name"
            className="form-select"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          >
            <option value="">Select Name</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
            <option value="Other">Add New</option>
          </select>
        </div>

        {/* New Member Inputs */}
        {isNewMember && (
          <>
            <div className="form-group">
              <label htmlFor="new-name">New Name</label>
              <input
                id="new-name"
                className="form-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-category">Category</label>
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
                <option value="New">New</option>
              </select>
            </div>
          </>
        )}

        {/* Read-only Category for Existing Member */}
        {!isNewMember && (
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              className="form-input"
              type="text"
              value={category}
              readOnly
            />
          </div>
        )}

        {/* Service Selection */}
        <div className="form-group">
          <label htmlFor="service">Service</label>
          <select
            id="service"
            className="form-select"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            required
          >
            <option value="">Select Service</option>
            {existingServices.map((srv) => (
              <option key={srv} value={srv}>
                {srv}
              </option>
            ))}
            <option value="Other">Enter New</option>
          </select>
        </div>

        {/* Custom Service Name */}
        {serviceName === "Other" && (
          <div className="form-group">
            <label htmlFor="custom-service">New Service Name</label>
            <input
              id="custom-service"
              className="form-input"
              type="text"
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              required
            />
          </div>
        )}

        {/* Date Picker */}
        <div className="form-group">
          <label htmlFor="date">Date</label>
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
          <span>Submit Attendance</span>
        </button>
      </form>

      {/* Navigation & Logout */}
      <div className="button-group">
        <button onClick={() => navigate("/")} className="nav-button">
          Home
        </button>
        <button onClick={() => navigate("/analytics")} className="nav-button">
          View Analytics
        </button>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </div>
  );
}
