import React from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AnalyticsComponent = ({ chartData }) => {
  // Handle undefined/null data
  if (!chartData || !chartData.labels || !chartData.datasets) {
    return <p>Loading analytics data...</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
      <div style={{ backgroundColor: "#f8f8f8", padding: "20px", borderRadius: "10px" }}>
        <h3 style={{ textAlign: "center" }}>Bar Chart</h3>
        <Bar data={chartData} />
      </div>

      <div style={{ backgroundColor: "#f8f8f8", padding: "20px", borderRadius: "10px" }}>
        <h3 style={{ textAlign: "center" }}>Pie Chart</h3>
        <Pie data={chartData} />
      </div>
    </div>
  );
};

export default AnalyticsComponent;
