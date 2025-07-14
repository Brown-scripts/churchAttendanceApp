import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { AdminOnly } from "../components/RoleBasedAccess";
import Navigation from "../components/Navigation";
import AnalyticsComponent from "../components/analytics";

export default function DetailedAnalytics() {
  const { serviceName } = useParams();
  const [serviceData, setServiceData] = useState(null);
  const [user] = useAuthState(auth);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "attendance"));
        const serviceAttendance = {};

        querySnapshot.forEach((docSnap) => {
          const entry = docSnap.data();
          const entryService = entry?.serviceName?.trim().toLowerCase();
          const routeService = serviceName.trim().toLowerCase();

          if (entryService === routeService) {
            const rawCat = entry.category;
            if (typeof rawCat === "string" && rawCat.trim() !== "") {
              const normalizedCat = rawCat.trim().toUpperCase();

              if (!serviceAttendance[normalizedCat]) {
                serviceAttendance[normalizedCat] = 0;
              }
              serviceAttendance[normalizedCat] += 1;
            }
          }
        });

        console.log("✅ Service Data:", serviceAttendance);
        setServiceData(serviceAttendance);
      } catch (error) {
        console.error("❌ Error fetching analytics data:", error);
      }
    };

    fetchData();
  }, [serviceName]);

  const handleDeleteService = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete all records for "${serviceName}"?`
      )
    )
      return;

    try {
      const serviceQuery = query(
        collection(db, "attendance"),
        where("serviceName", "==", serviceName)
      );
      const querySnapshot = await getDocs(serviceQuery);

      for (const docSnapshot of querySnapshot.docs) {
        await deleteDoc(doc(db, "attendance", docSnapshot.id));
      }

      alert(`${serviceName} has been deleted.`);
      navigate("/analytics");
    } catch (error) {
      console.error("❌ Error deleting service:", error);
      alert("Failed to delete service.");
    }
  };

  const getRandomColor = () =>
    "#" + Math.floor(Math.random() * 16777215).toString(16);

  if (!serviceData) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading Detailed Analytics...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (Object.keys(serviceData).length === 0) {
    return (
      <>
        <Navigation user={user} />
        <div className="page-content">
          <div className="analytics-container">
            <div className="page-header-clean">
              <h1>No Data Available</h1>
              <p>No attendance data found for "{serviceName}"</p>
            </div>
            <div className="button-group">
              <button onClick={() => navigate("/analytics")} className="btn-primary">
                Back to Analytics
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const chartLabels = Object.keys(serviceData);
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: `${serviceName} Attendance`,
        data: chartLabels.map((cat) => serviceData[cat]),
        backgroundColor: chartLabels.map(() => getRandomColor()),
      },
    ],
  };

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="analytics-container">
          {/* Page Header */}
          <div className="page-header-clean">
            <h1>📊 {serviceName} Analytics</h1>
            <p>Detailed attendance breakdown for {serviceName}</p>
          </div>

          {/* Chart Section */}
          <div className="chart-container">
            <AnalyticsComponent chartData={chartData} />
          </div>

          {/* Navigation Buttons */}
          <div className="button-group" style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
            <button onClick={() => navigate("/analytics")} className="btn-secondary">
              Back to Analytics
            </button>
            <button onClick={handleDeleteService} className="btn-danger">
              Delete Service
            </button>
          </div>

          {/* Floating Quick Access Menu */}
          <div className="floating-quick-menu">
            <div className="quick-menu-item" onClick={() => navigate('/')} title="Home">
              <span className="menu-icon">🏠</span>
            </div>
            <div className="quick-menu-item" onClick={() => navigate('/attendance')} title="Add Attendance">
              <span className="menu-icon">➕</span>
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
          </div>
        </div>
      </div>
    </>
  );
}
