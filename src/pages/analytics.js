import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import AnalyticsComponent from "../components/analytics";
import generateReport from "../components/reportGenerator";

export default function Analytics() {
  const [services, setServices] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  const fetchAttendanceData = async () => {
    const querySnapshot = await getDocs(collection(db, "attendance"));
    let serviceAttendance = {};

    querySnapshot.forEach((doc) => {
      const entry = doc.data();
      const { serviceName, category } = entry;

      if (!serviceAttendance[serviceName]) {
        serviceAttendance[serviceName] = { total: 0, categories: {} };
      }
      serviceAttendance[serviceName].total += 1;

      if (!serviceAttendance[serviceName].categories[category]) {
        serviceAttendance[serviceName].categories[category] = 0;
      }
      serviceAttendance[serviceName].categories[category] += 1;
    });

    setServices(Object.keys(serviceAttendance));
    setAttendanceData(serviceAttendance);
  };

  if (!services.length) {
    return <h3 style={{ textAlign: "center" }}>Loading Analytics...</h3>;
  }

  const chartData = {
    labels: services,
    datasets: [
      {
        label: "Total Attendance",
        data: services.map((service) => attendanceData[service].total || 0),
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#607D8B"],
      },
    ],
  };

  return (
    <div className="container">
      <h2 className="title">📊 Attendance Analytics</h2>

      {/* Summary Chart (Total Attendance per Service) */}
      <AnalyticsComponent chartData={chartData} />

      {/* Clickable Service List for Detailed Analytics */}
      <div className="service-list">
    
        {services.map((service) => (
          <button key={service} className="service-button" onClick={() => navigate(`/analytics/${service}`)}>
            {service} ({attendanceData[service].total})
          </button>
        ))}
      </div>

      {/* Navigation & Report Generation */}
      <div className="button-group">

        <button onClick={() => navigate("/attendance")} className="nav-button">Manage Attendance</button>
        <button onClick={() => navigate("/")} className="nav-button">Home</button>
      </div>
    </div>
  );
}
