import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/image.png";
import generateReport from "../components/reportGenerator"; // Import the function

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false); // State to track modal visibility
  const [serviceName, setServiceName] = useState(""); // State to store service name input
  const navigate = useNavigate();

  // Handle opening of the modal
  const handleGenerateReportClick = () => {
    setIsModalOpen(true);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setServiceName(""); // Reset the input field
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (serviceName) {
      generateReport(serviceName); // Generate report for the entered service
      handleCloseModal(); // Close the modal after submitting
    } else {
      alert("Please enter a service name.");
    }
  };

  return (
    <div className="home-container">
      <div className="header">
        <img src={logo} alt="Church Logo" className="logo" />
        <h1 className="church-name">Universal Radiant Family, Legon, Zone 1</h1>
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
