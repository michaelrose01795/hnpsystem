// file location: src/pages/api/clocking/clockIn.js
let clockingData = {}; // In-memory storage for MVP

export default function handler(req, res) {
  if (req.method === "POST") {
    const { user } = JSON.parse(req.body);
    const now = new Date();
    if (!clockingData[user]) {
      clockingData[user] = { clockedIn: true, clockInTime: now, hoursWorked: 0 };
    } else {
      clockingData[user].clockedIn = true;
      clockingData[user].clockInTime = now;
    }
    res.status(200).json({ message: "Clocked in", clockedIn: true });
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
