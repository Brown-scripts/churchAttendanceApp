import React, { useRef } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement, Filler } from "chart.js";
import { Download } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement, Filler);

const downloadChartPng = (chartRef, name) => {
  const chart = chartRef.current;
  if (!chart) return;
  // Render on a white background so the PNG looks right in light & dark themes.
  const src = chart.canvas;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  const url = out.toDataURL("image/png");
  const stamp = new Date().toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_${stamp}.png`;
  a.click();
};

const ExportPngButton = ({ onClick }) => (
  <button
    type="button"
    className="chart-export-btn"
    onClick={onClick}
    aria-label="Download chart as PNG"
    title="Download as PNG"
  >
    <Download size={12} strokeWidth={2.5} className="icon-inline" style={{ marginRight: '0.25rem' }} />
    PNG
  </button>
);

// Standalone Bar chart
export const BarChart = ({ chartData, height = 300, exportName }) => {
  const ref = useRef(null);
  if (!chartData?.labels || !chartData?.datasets) return null;
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', cornerRadius: 8 },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.08)' } },
      x: { grid: { display: false } },
    },
  };
  return (
    <div className="chart-wrap">
      {exportName && (
        <div className="chart-toolbar">
          <ExportPngButton onClick={() => downloadChartPng(ref, exportName)} />
        </div>
      )}
      <div style={{ height: `${height}px`, width: '100%' }}>
        <Bar ref={ref} data={chartData} options={options} />
      </div>
    </div>
  );
};

// Line chart component
export const LineChart = ({ chartData, height = 300, exportName }) => {
  const ref = useRef(null);
  if (!chartData?.labels || !chartData?.datasets) return null;
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', cornerRadius: 8 },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.08)' } },
      x: { grid: { display: false } },
    },
  };
  return (
    <div className="chart-wrap">
      {exportName && (
        <div className="chart-toolbar">
          <ExportPngButton onClick={() => downloadChartPng(ref, exportName)} />
        </div>
      )}
      <div style={{ height: `${height}px`, width: '100%' }}>
        <Line ref={ref} data={chartData} options={options} />
      </div>
    </div>
  );
};

const AnalyticsComponent = ({ chartData, exportName }) => {
  const barRef = useRef(null);
  const pieRef = useRef(null);

  if (!chartData || !chartData.labels || !chartData.datasets) {
    return <p style={{ textAlign: "center", color: "#6b7280" }}>Loading analytics data...</p>;
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 20, usePointStyle: true, font: { size: 12, weight: '500' } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff', bodyColor: '#ffffff',
        borderColor: '#3b82f6', borderWidth: 1,
        cornerRadius: 8, displayColors: true,
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.1)' }, ticks: { font: { size: 11, weight: '500' } } },
      x: { grid: { display: false }, ticks: { font: { size: 11, weight: '500' } } },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 20, usePointStyle: true, font: { size: 12, weight: '500' } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff', bodyColor: '#ffffff',
        borderColor: '#3b82f6', borderWidth: 1,
        cornerRadius: 8, displayColors: true,
      },
    },
  };

  return (
    <div className="analytics-responsive">
      <div className="charts-wrapper">
        <div className="chart-block">
          <div className="chart-block-header">
            <h3>Bar Chart</h3>
            {exportName && (
              <ExportPngButton onClick={() => downloadChartPng(barRef, `${exportName}_bar`)} />
            )}
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <Bar ref={barRef} data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-block">
          <div className="chart-block-header">
            <h3>Pie Chart</h3>
            {exportName && (
              <ExportPngButton onClick={() => downloadChartPng(pieRef, `${exportName}_pie`)} />
            )}
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <Pie ref={pieRef} data={chartData} options={pieOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsComponent;
