import React from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AnalyticsComponent = ({ chartData }) => {
  // Handle undefined/null data
  if (!chartData || !chartData.labels || !chartData.datasets) {
    return <p style={{ textAlign: "center", color: "#6b7280" }}>Loading analytics data...</p>;
  }

  // Enhanced Chart options for vibrant, professional appearance
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            weight: '500',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11,
            weight: '500',
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
            weight: '500',
          },
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            weight: '500',
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
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
