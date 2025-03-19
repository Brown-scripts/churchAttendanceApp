import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import AnalyticsComponent from "../components/analytics";

const categories = ["L100s", "Continuing Students", "L400s", "Workers", "Others", "New"];

export default function DetailedAnalytics() {
  const { serviceName } = useParams();
  const [serviceData, setServiceData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchServiceData();
  }, []);

  const fetchServiceData = async () => {
    const querySnapshot = await getDocs(collection(db, "attendance"));
    let serviceAttendance = {};

    querySnapshot.forEach((doc) => {
      const entry = doc.data();
      if (entry.serviceName === serviceName) {
        if (!serviceAttendance[entry.category]) {
          serviceAttendance[entry.category] = 0;
        }
        serviceAttendance[entry.category] += 1;
      }
    });

    setServiceData(serviceAttendance);
  };

  // Prevent errors when data is still loading or missing
  if (!serviceData) {
    return <h3 style={{ textAlign: "center" }}>Loading Detailed Analytics...</h3>;
  }

  if (Object.keys(serviceData).length === 0) {
    return <h3 style={{ textAlign: "center" }}>No Data Available for {serviceName}</h3>;
  }

  const chartData = {
    labels: categories,
    datasets: [
      {
        label: `${serviceName} Attendance`,
        data: categories.map((cat) => serviceData[cat] || 0),
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#607D8B"],
      },
    ],
  };

  return (
    <div className="container">
      <h2 className="title">📊 {serviceName} - Detailed Analytics</h2>
      <AnalyticsComponent chartData={chartData} />
      <div className="button-group">
        <button onClick={() => navigate("/analytics")} className="nav-button">🔙 Back to Overview</button>
      </div>
    </div>
  );
}
