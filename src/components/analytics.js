import React from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AnalyticsComponent = ({ chartData }) => {
  // Handle undefined/null data
  if (!chartData || !chartData.labels || !chartData.datasets) {
    return <p style={{ textAlign: "center", color: "#6b7280" }}>Loading analytics data...</p>;
  }

  // Chart options for responsiveness
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="analytics-responsive">
      <div className="charts-wrapper">
        <div className="chart-block">
          <h3>Bar Chart</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-block">
          <h3>Pie Chart</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <Pie data={chartData} options={pieOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsComponent;
