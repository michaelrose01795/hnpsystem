// file location: src/pages/workshop/ControllerClocking.js
import React, { useState } from "react";

export default function ControllerClocking() {
  const techs = ["Tech1", "Tech2", "Tech3", "Tech4"];
  const [clocking, setClocking] = useState({});

  const clockIn = (tech) => setClocking((prev) => ({ ...prev, [tech]: "In" }));
  const clockOut = (tech) => setClocking((prev) => ({ ...prev, [tech]: "Out" }));

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ color: "#FF4040", fontSize: "1.8rem", marginBottom: "20px" }}>
        Workshop Controller Dashboard
      </h1>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#FFCCCC" }}>
            <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Technician</th>
            <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Status</th>
            <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Clock In</th>
            <th style={{ padding: "8px", border: "1px solid #FFAAAA" }}>Clock Out</th>
          </tr>
        </thead>
        <tbody>
          {techs.map((tech) => (
            <tr key={tech}>
              <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{tech}</td>
              <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>{clocking[tech] || "Not Clocked"}</td>
              <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>
                <button onClick={() => clockIn(tech)} style={{ padding: "4px 8px" }}>IN</button>
              </td>
              <td style={{ padding: "8px", border: "1px solid #FFAAAA" }}>
                <button onClick={() => clockOut(tech)} style={{ padding: "4px 8px" }}>OUT</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
