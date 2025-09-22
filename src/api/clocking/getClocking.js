// file location: src/pages/api/clocking/getClocking.js
let clockingData = {}; // In-memory storage for MVP

export default function handler(req, res) {
  const { user } = req.query;
  if (user) {
    const data = clockingData[user] || { clockedIn: false, hoursWorked: 0 };
    res.status(200).json(data);
  } else {
    // return all users (for admin)
    res.status(200).json(Object.entries(clockingData).map(([user, data]) => ({ user, ...data })));
  }
}
