// src/app/dashboard/page.tsx
import React from "react"; // import React for JSX
import "./Dashboard.css"; // optional, import CSS for styling dashboard

const Dashboard: React.FC = () => { // functional component for the Dashboard page
  // Example placeholder data
  const jobsSummary = 27; // total jobs count
  const activeUsers = 12; // total active users
  const quickStats = [ // array of quick stats to display
    { title: "Completed Jobs", value: 102 },
    { title: "Pending Jobs", value: 5 },
    { title: "Overdue Jobs", value: 3 },
  ];

  return (
    <div className="dashboard-container"> {/* main wrapper for dashboard */}
      <h1>Dashboard - Overview</h1> {/* page title */}

      <div className="dashboard-cards"> {/* container for stat cards */}
        <div className="card"> {/* card 1 */}
          <h2>Jobs Summary</h2> {/* card title */}
          <p>{jobsSummary}</p> {/* display total jobs */}
        </div>
        <div className="card"> {/* card 2 */}
          <h2>Active Users</h2>
          <p>{activeUsers}</p> {/* display active users */}
        </div>
        <div className="card"> {/* card 3 */}
          <h2>Quick Stats</h2>
          <ul> {/* list of additional stats */}
            {quickStats.map((stat, index) => ( // loop through quickStats array
              <li key={index}> {/* unique key for each list item */}
                {stat.title}: {stat.value} {/* display title and value */}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; // export component to be used in routes
