import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth"; // 🔹 Firebase Auth
import logo from "../assets/image.png";
import generateReport from "../components/reportGenerator"; // Import the function

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [user, setUser] = useState(null); // 🔹 Track logged-in user
  const navigate = useNavigate();
  const auth = getAuth(); // 🔹 Get Firebase Auth instance

  // 🔹 Check Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 🔹 Handle Logout
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
      alert("Please enter a service name.");
    }
  };

  return (
    <div className="home-container">
      {/* Top Navigation Bar */}
      <div className="top-bar">
        {user ? (
          <button onClick={handleLogout} className="logout-button">Logout</button> // 🔹 Show Logout when logged in
        ) : (
          <button onClick={() => navigate("/login")} className="login-button">Login</button> // 🔹 Show Login when not logged in
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

      {/* Modal for Service Name Input */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Enter Service Name</h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Service Name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                required
              />
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
