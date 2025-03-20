import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth"; 
import { db } from "../firebase";
import AnalyticsComponent from "../components/analytics";

const categories = ["L100s", "Continuing Students", "L400s", "Workers", "Others", "New"];

export default function DetailedAnalytics() {
  const { serviceName } = useParams();
  const [serviceData, setServiceData] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth(); 

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

  // 🔹 Handle Delete Service Function
  const handleDeleteService = async () => {
    if (!window.confirm(`Are you sure you want to delete all records for ${serviceName}?`)) return;

    try {
      const serviceQuery = query(collection(db, "attendance"), where("serviceName", "==", serviceName));
      const querySnapshot = await getDocs(serviceQuery);

      querySnapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, "attendance", docSnapshot.id));
      });

      alert(`${serviceName} has been deleted.`);
      navigate("/analytics"); // Redirect after deletion
    } catch (error) {
      console.error("Error deleting service:", error);
      alert("Failed to delete service.");
    }
  };

  // 🔹 Handle Logout Function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); 
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

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

      {/* Navigation, Delete & Logout */}
      <div className="button-group">
        <button onClick={() => navigate("/analytics")} className="nav-button">Back to Overview</button>
        <button onClick={handleDeleteService} className="delete-button">Delete Service</button>
      </div>
    </div>
  );
}
