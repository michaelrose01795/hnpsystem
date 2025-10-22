// ✅ File location: src/pages/api/clocking/clockIn.js
import { clockIn } from "@/lib/database/clocking";

/**
 * API endpoint to clock in a user
 * POST /api/clocking/clockIn
 * Body: { userId: "user_id_here" }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId, user } = req.body; // Support both userId and user for backwards compatibility
    const userIdToUse = userId || user;

    if (!userIdToUse) {
      return res.status(400).json({ 
        message: 'User ID required',
        clockedIn: false 
      });
    }

    console.log('🕐 Clock in request for user:', userIdToUse);

    // ✅ Call database function
    const result = await clockIn(userIdToUse);

    if (!result.success) {
      console.log('⚠️ Clock in failed:', result.error.message);
      return res.status(400).json({ 
        message: result.error.message,
        clockedIn: false 
      });
    }

    console.log('✅ User clocked in successfully');

    return res.status(200).json({ 
      message: 'Clocked in successfully',
      clockedIn: true,
      data: {
        id: result.data.id,
        userId: result.data.user_id,
        clockInTime: result.data.clock_in,
        date: result.data.date
      }
    });

  } catch (error) {
    console.error('❌ Clock in error:', error);
    return res.status(500).json({ 
      message: 'Server error during clock in',
      clockedIn: false,
      error: error.message 
    });
  }
}