// ✅ File location: src/pages/api/clocking/getClocking.js
import { getClockingStatus, getTodayClockingRecords } from "@/lib/database/clocking";

/**
 * API endpoint to get clocking data
 * GET /api/clocking/getClocking?user=user_id (for specific user)
 * GET /api/clocking/getClocking?userId=user_id (alternative)
 * GET /api/clocking/getClocking (for all today's records - admin view)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { user, userId } = req.query;
    const userIdToUse = user || userId;

    // If user/userId provided, get specific user's status
    if (userIdToUse) {
      console.log('🔍 Getting clocking status for user:', userIdToUse);

      const result = await getClockingStatus(userIdToUse);

      if (result.error) {
        console.error('❌ Error getting status:', result.error);
        return res.status(500).json({ 
          message: 'Error fetching clocking status',
          clockedIn: false,
          hoursWorked: 0,
          error: result.error.message 
        });
      }

      // Format response to match your original structure
      return res.status(200).json({
        clockedIn: result.isClockedIn,
        hoursWorked: result.data?.hours_worked ? parseFloat(result.data.hours_worked) : 0,
        clockInTime: result.data?.clock_in || null,
        date: result.data?.date || null,
        data: result.data
      });
    }

    // Otherwise, get all today's clocking records (for admin dashboard)
    console.log('🔍 Getting all today\'s clocking records');

    const records = await getTodayClockingRecords();

    // Format to match original structure: array of { user, ...data }
    return res.status(200).json(
      records.map(record => ({
        user: record.user_id,
        userName: record.user ? `${record.user.first_name} ${record.user.last_name}` : 'Unknown',
        department: record.user?.department || 'Unknown',
        clockedIn: !record.clock_out, // If no clock_out, still clocked in
        clockInTime: record.clock_in,
        clockOutTime: record.clock_out,
        hoursWorked: record.hours_worked ? parseFloat(record.hours_worked) : 0,
        date: record.date,
        id: record.id
      }))
    );

  } catch (error) {
    console.error('❌ Get clocking error:', error);
    return res.status(500).json({ 
      message: 'Server error while fetching clocking data',
      error: error.message 
    });
  }
}