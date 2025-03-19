import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, attendanceCollection } from "../firebase";
import { getDocs } from "firebase/firestore";
import AttendanceList from "../components/attendanceList";
import AttendanceForm from "../components/attendanceForm";
import generateReport from "../components/reportGenerator";

const categories = ["L100s", "Continuing Students", "L400s", "Workers", "Others", "New"];

export default function Attendance() {
  const [attendance, setAttendance] = useState({});
  const [servicesData, setServicesData] = useState({}); // Store total attendance per service
  const navigate = useNavigate();

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    const querySnapshot = await getDocs(attendanceCollection);
    let data = {};
    let serviceTotals = {}; // Track total attendance per service

    querySnapshot.forEach((doc) => {
      const entry = doc.data();
      const key = `${entry.date} - ${entry.serviceName}`;
      const serviceName = entry.serviceName;

      if (!data[key]) data[key] = {};
      if (!data[key][entry.category]) data[key][entry.category] = [];
      data[key][entry.category].push(entry.name);

      // 🔹 Track attendance per service
      if (!serviceTotals[serviceName]) serviceTotals[serviceName] = 0;
      serviceTotals[serviceName]++;
    });

    setAttendance(data);
    setServicesData(serviceTotals); // Save totals
  };

  return (
    <div className="container">
      <h1 className="title">Manage Attendance</h1>

      

      {/* Attendance Form & List */}
      <div className="content-container">
        <AttendanceForm fetchAttendance={fetchAttendance} />
        
      </div>

      {/* Generate Report Button */}
      {/* Navigation Buttons */}
      <div className="button-group">
        <button onClick={() => navigate("/")} className="nav-button">Home</button>
        <button onClick={() => navigate("/analytics")} className="nav-button">View Analytics</button>
      </div>

    </div>
  );
}
