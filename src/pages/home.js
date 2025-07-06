import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Navigation from "../components/Navigation";
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
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="home-container">

      {/* Modern Header Section */}
      <div className="header">
        <div className="logo-container">
          <img src={logo} alt="Church Logo" className="logo" />
          <div className="logo-glow"></div>
        </div>
        <h1 className="church-name">Universal Radiant Family</h1>
        <h2 className="church-name zone-name">Zone 1</h2>
        <p className="welcome-text">
          Welcome to our comprehensive church attendance and analytics system.
          Manage your congregation with modern tools and insights.
        </p>
      </div>

      {/* Modern Action Buttons */}
      <div className="buttons-container">
        <button onClick={() => navigate("/attendance")} className="action-button">
          Manage Attendance
        </button>

        <button onClick={() => navigate("/analytics")} className="action-button">
          View Analytics
        </button>

        <button onClick={handleGenerateReportClick} className="action-button">
          Generate Report
        </button>
      </div>

      {/* Modern Modal for Service Name Selection */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generate Report</h2>
            </div>

            <div className="modal-body">
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="serviceSelect" className="form-label">
                    Service
                  </label>
                  <select
                    id="serviceSelect"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    required
                  >
                    <option value="" disabled>Choose a service...</option>
                    {serviceList.map((name, index) => (
                      <option key={index} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-buttons">
                  <button type="submit" className="submit-button">
                    Generate
                  </button>
                  <button type="button" onClick={handleCloseModal} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
}
