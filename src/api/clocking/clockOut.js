// ✅ File location: src/pages/api/clocking/clockOut.js
import { clockOut } from "@/lib/database/clocking";

/**
 * API endpoint to clock out a user
 * POST /api/clocking/clockOut
 * Body: { userId: "user_id_here" } or { user: "user_id_here" }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse body (handle both JSON string and object)
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { userId, user } = body;
    const userIdToUse = userId || user;

    if (!userIdToUse) {
      return res.status(400).json({ 
        message: 'User ID required',
        clockedIn: true 
      });
    }

    console.log('🕐 Clock out request for user:', userIdToUse);

    // ✅ Call database function
    const result = await clockOut(userIdToUse);

    if (!result.success) {
      console.log('⚠️ Clock out failed:', result.error.message);
      return res.status(400).json({ 
        message: result.error.message,
        clockedIn: true 
      });
    }

    console.log('✅ User clocked out successfully. Hours worked:', result.data.hours_worked);

    return res.status(200).json({ 
      message: 'Clocked out',
      clockedIn: false,
      hoursWorked: parseFloat(result.data.hours_worked),
      data: {
        id: result.data.id,
        userId: result.data.user_id,
        clockInTime: result.data.clock_in,
        clockOutTime: result.data.clock_out,
        hoursWorked: parseFloat(result.data.hours_worked),
        date: result.data.date
      }
    });

  } catch (error) {
    console.error('❌ Clock out error:', error);
    return res.status(500).json({ 
      message: 'Server error during clock out',
      clockedIn: true,
      error: error.message 
    });
  }
}