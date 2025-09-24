// file location: src/pages/api/clocking/clockOut.js
let clockingData = {}; // In-memory storage for MVP

export default function handler(req, res) {
  if (req.method === "POST") {
    const { user } = JSON.parse(req.body);
    const now = new Date();
    if (clockingData[user] && clockingData[user].clockedIn) {
      const clockInTime = new Date(clockingData[user].clockInTime);
      const hours = (now - clockInTime) / 1000 / 3600;
      clockingData[user].hoursWorked += hours;
      clockingData[user].clockedIn = false;
    }
    res.status(200).json({ message: "Clocked out", clockedIn: false });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
