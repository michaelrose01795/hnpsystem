import React from "react";
import "./Dashboard.css"; // optional, for styling

const Dashboard: React.FC = () => {
  // Example placeholder data
  const jobsSummary = 27;
  const activeUsers = 12;
  const quickStats = [
    { title: "Completed Jobs", value: 102 },
    { title: "Pending Jobs", value: 5 },
    { title: "Overdue Jobs", value: 3 },
  ];

  return (
    <div className="dashboard-container">
      <h1>Dashboard - Overview</h1>

      <div className="dashboard-cards">
        <div className="card">
          <h2>Jobs Summary</h2>
          <p>{jobsSummary}</p>
        </div>
        <div className="card">
          <h2>Active Users</h2>
          <p>{activeUsers}</p>
        </div>
        <div className="card">
          <h2>Quick Stats</h2>
          <ul>
            {quickStats.map((stat, index) => (
              <li key={index}>
                {stat.title}: {stat.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
