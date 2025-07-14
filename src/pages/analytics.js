import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { AdminOnly } from "../components/RoleBasedAccess";
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

  // 🔹 Chart Data - Vibrant Professional Color Scheme
  const vibrantColors = [
    "#3b82f6", // Bright Blue
    "#10b981", // Emerald Green
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Purple
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#84cc16", // Lime
    "#ec4899", // Pink
    "#6366f1", // Indigo
    "#14b8a6", // Teal
    "#f43f5e", // Rose
  ];

  const chartData = {
    labels: services,
    datasets: [
      {
        label: "Total Attendance",
        data: services.map((service) => attendanceData[service]?.total || 0),
        backgroundColor: vibrantColors.slice(0, services.length),
        borderColor: vibrantColors.slice(0, services.length),
        borderWidth: 2,
        hoverBackgroundColor: vibrantColors.slice(0, services.length).map(color => color + '80'), // Add transparency on hover
        hoverBorderColor: vibrantColors.slice(0, services.length),
        hoverBorderWidth: 3,
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
      

      {/* Floating Quick Access Menu */}
      <div className="floating-quick-menu">
        <div className="quick-menu-item" onClick={() => navigate('/')} title="Home">
          <span className="menu-icon">🏠</span>
        </div>
        <div className="quick-menu-item" onClick={() => navigate('/attendance')} title="Add Attendance">
          <span className="menu-icon">➕</span>
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
    </>
  );
}
