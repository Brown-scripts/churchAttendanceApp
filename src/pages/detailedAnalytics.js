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
import AnalyticsComponent from "../components/analytics";

export default function DetailedAnalytics() {
  const { serviceName } = useParams();
  const [serviceData, setServiceData] = useState(null);
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
    return <h3 style={{ textAlign: "center" }}>Loading Detailed Analytics...</h3>;
  }

  if (Object.keys(serviceData).length === 0) {
    return (
      <h3 style={{ textAlign: "center" }}>
        No Data Available for "{serviceName}"
      </h3>
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
    <div className="container">
      <h2 className="title">📊 {serviceName} - Detailed Analytics</h2>
      <AnalyticsComponent chartData={chartData} />

      {/* Navigation Buttons */}
      <div className="button-group">
        <button onClick={() => navigate("/analytics")} className="nav-button">
          Back to Overview
        </button>
        <button onClick={handleDeleteService} className="delete-button">
          Delete Service
        </button>
      </div>
    </div>
  );
}
