import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth"; // 🔹 Import Firebase Auth
import AnalyticsComponent from "../components/analytics";

export default function Analytics() {
  const [services, setServices] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const navigate = useNavigate();
  const auth = getAuth(); // 🔹 Firebase Auth instance

  // 🔹 Fetch attendance data on component mount
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

  // 🔹 Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); // Redirect to login after logout
    } catch (error) {
      console.error("Logout Error:", error);
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
    <div className="container">
      <h2 className="title">📊 Attendance Analytics</h2>

      {/* 🔹 Summary Chart (Total Attendance per Service) */}
      <AnalyticsComponent chartData={chartData} />

      {/* 🔹 Clickable Service List for Detailed Analytics */}
      <div className="service-list">
        {services.map((service) => (
          <button 
            key={service} 
            className="service-button" 
            onClick={() => navigate(`/analytics/${service}`)}
          >
            {service} ({attendanceData[service]?.total || 0})
          </button>
        ))}
      </div>

      {/* 🔹 Navigation & Logout */}
      <div className="button-group">
        <button onClick={() => navigate("/")} className="nav-button">Home</button>
        <button onClick={() => navigate("/attendance")} className="nav-button">Manage Attendance</button>
        <button onClick={handleLogout} className="logout-button">Logout</button> {/* 🔹 Logout Button */}
      </div>
    </div>
  );
}
