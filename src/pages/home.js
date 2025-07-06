import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // Make sure this points to your Firebase config
import logo from "../assets/image.png";
import generateReport from "../components/reportGenerator";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceList, setServiceList] = useState([]); // Unique service names
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Check user authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Fetch unique service names when modal opens
  useEffect(() => {
    const fetchUniqueServiceNames = async () => {
      try {
        const snapshot = await getDocs(collection(db, "attendance"));
        const namesSet = new Set();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.serviceName) {
            namesSet.add(data.serviceName.trim());
          }
        });

        setServiceList(Array.from(namesSet));
      } catch (error) {
        console.error("Error fetching service names:", error);
      }
    };

    if (isModalOpen) {
      fetchUniqueServiceNames();
    }
  }, [isModalOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleGenerateReportClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setServiceName("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (serviceName) {
      generateReport(serviceName);
      handleCloseModal();
    } else {
      alert("Please select a service name.");
    }
  };

  return (
    <div className="home-container">
      {/* Top Navigation Bar */}
      <div className="top-bar">
        {user ? (
          <button onClick={handleLogout} className="logout-button">Logout</button>
        ) : (
          <button onClick={() => navigate("/login")} className="login-button">Login</button>
        )}
      </div>

      <div className="header">
        <img src={logo} alt="Church Logo" className="logo" />
        <h1 className="church-name">Universal Radiant Family</h1>
        <h2 className="church-name">Zone 1</h2>
        <p className="welcome-text">Welcome to the church attendance and analytics system.</p>
      </div>

      {/* Buttons Container */}
      <div className="buttons-container">
        <button onClick={() => navigate("/attendance")} className="action-button">Manage Attendance</button>
        <button onClick={() => navigate("/analytics")} className="action-button">View Analytics</button>
        <button onClick={handleGenerateReportClick} className="action-button">Generate Report</button>
      </div>

      {/* Modal for Service Name Selection */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Select Service Name</h2>
            <form onSubmit={handleSubmit}>
              <select
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                required
              >
                <option value="" disabled>Select a service</option>
                {serviceList.map((name, index) => (
                  <option key={index} value={name}>{name}</option>
                ))}
              </select>
              <div className="modal-buttons">
                <button type="submit" className="submit-button">Generate Report</button>
                <button type="button" onClick={handleCloseModal} className="cancel-button">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
