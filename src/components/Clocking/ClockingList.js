// file location: src/components/Clocking/ClockingList.js
import React, { useEffect, useState } from "react";

export default function ClockingList() {
  const [usersClocking, setUsersClocking] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/clocking/getClocking");
      const data = await res.json();
      setUsersClocking(data);
    };
    fetchData();
  }, []);

  return (
    <div className="p-6 bg-white shadow rounded w-full max-w-3xl">
      <h2 className="text-xl font-bold mb-4">All Users Clocking</h2>
      <table className="w-full table-auto border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border px-4 py-2">User</th>
            <th className="border px-4 py-2">Status</th>
            <th className="border px-4 py-2">Hours Worked</th>
          </tr>
        </thead>
        <tbody>
          {usersClocking.map((u) => (
            <tr key={u.user}>
              <td className="border px-4 py-2">{u.user}</td>
              <td className="border px-4 py-2">{u.clockedIn ? "In" : "Out"}</td>
              <td className="border px-4 py-2">{u.hoursWorked.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
