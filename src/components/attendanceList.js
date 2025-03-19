import React from "react";

export default function AttendanceList({ attendance }) {
  return (
    <div className="list-container">
      <h2>Attendance List</h2>
      {Object.keys(attendance).map((session) => (
        <div key={session} className="session-card">
          <h3>{session}</h3>
          {Object.keys(attendance[session]).map((category) => (
            <div key={category}>
              <strong>{category}:</strong> {attendance[session][category]?.join(", ") || "None"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
