import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Navigation from "../components/Navigation";
import AnalyticsComponent from "../components/analytics";

export default function Analytics() {
  const [services, setServices] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Check user authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  // Fetch attendance data on component mount
  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // 🔹 Fetch attendance data from Firestore
  const fetchAttendanceData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "attendance"));
      let serviceAttendance = {};

      querySnapshot.forEach((doc) => {
        const { serviceName, category } = doc.data();

        if (!serviceAttendance[serviceName]) {
          serviceAttendance[serviceName] = { total: 0, categories: {} };
        }

        serviceAttendance[serviceName].total += 1;
        serviceAttendance[serviceName].categories[category] = 
          (serviceAttendance[serviceName].categories[category] || 0) + 1;
      });

      setServices(Object.keys(serviceAttendance));
      setAttendanceData(serviceAttendance);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    }
  };



  // 🔹 Loading state while fetching data
  if (!services.length) {
    return <h3 style={{ textAlign: "center" }}>Loading Analytics...</h3>;
  }

  // 🔹 Chart Data
  const chartData = {
    labels: services,
    datasets: [
      {
        label: "Total Attendance",
        data: services.map((service) => attendanceData[service]?.total || 0),
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#607D8B"],
      },
    ],
  };

  return (
    <>
      <Navigation user={user} />
      <div className="page-content">
        <div className="analytics-container">
          {/* Page Header */}
          <div className="page-header">
            <h1>Attendance Analytics</h1>
            <p>View attendance trends and insights across all services</p>
          </div>

      {/* Chart Section */}
      <div className="chart-container">
        <AnalyticsComponent chartData={chartData} />
      </div>

      {/* Service List */}
      <div className="services-section">
        <h3>Services Overview</h3>
        <div className="service-list">
          {services.map((service) => (
            <button
              key={service}
              className="service-button"
              onClick={() => navigate(`/analytics/${service}`)}
            >
              <div className="service-name">{service}</div>
              <div className="service-count">{attendanceData[service]?.total || 0} attendees</div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      {/* Quick Actions */}
      <div className="quick-actions">
        <button onClick={() => navigate("/attendance")} className="quick-action-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Manage Attendance
        </button>
      </div>
        </div>
      </div>
    </>
  );
}
