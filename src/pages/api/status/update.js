// file location: src/pages/api/status/update.js

// API endpoint to update job status
// This handles status transitions, validates them, and records history
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId, newStatus, userId, notes } = req.body;

  // Validation
  if (!jobId || !newStatus || !userId) {
    return res.status(400).json({ 
      error: 'Missing required fields: jobId, newStatus, userId' 
    });
  }

  try {
    // TODO: Replace with your actual database connection
    // const db = await connectToDatabase();

    // Get current status from database
    // const currentJob = await db.query('SELECT status FROM jobs WHERE id = ?', [jobId]);
    const currentJob = { status: 'in_progress' }; // Mock data
    
    // Import validation function - ✅ FIXED PATH
    const { isValidTransition, SERVICE_STATUS_FLOW } = require('../../../lib/status/statusFlow');
    
    // Validate the status transition
    if (!isValidTransition(currentJob.status, newStatus)) {
      return res.status(400).json({
        error: 'Invalid status transition',
        from: currentJob.status,
        to: newStatus,
        allowedNext: SERVICE_STATUS_FLOW[currentJob.status.toUpperCase()]?.next
      });
    }

    const timestamp = new Date().toISOString();
    
    // Calculate duration of previous status
    // const lastStatusChange = await db.query(
    //   'SELECT timestamp FROM status_history WHERE job_id = ? ORDER BY timestamp DESC LIMIT 1',
    //   [jobId]
    // );
    
    // const duration = lastStatusChange 
    //   ? Math.floor((new Date(timestamp) - new Date(lastStatusChange.timestamp)) / 1000)
    //   : 0;

    const duration = 120; // Mock: 2 minutes

    // Update job status in main jobs table
    // await db.query(
    //   'UPDATE jobs SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    //   [newStatus, timestamp, userId, jobId]
    // );

    // Insert into status history table
    // await db.query(
    //   'INSERT INTO status_history (job_id, status, user_id, timestamp, duration, notes) VALUES (?, ?, ?, ?, ?, ?)',
    //   [jobId, newStatus, userId, timestamp, duration, notes]
    // );

    const newStatusObj = SERVICE_STATUS_FLOW[newStatus.toUpperCase()];

    // Send notifications if required
    if (newStatusObj.notifyDepartment) {
      // await sendDepartmentNotification(newStatusObj.notifyDepartment, jobId, newStatus);
      console.log(`Notification sent to ${newStatusObj.notifyDepartment}`);
    }

    if (newStatusObj.notifyDepartments) {
      for (const dept of newStatusObj.notifyDepartments) {
        // await sendDepartmentNotification(dept, jobId, newStatus);
        console.log(`Notification sent to ${dept}`);
      }
    }

    if (newStatusObj.notifyCustomer) {
      // await sendCustomerNotification(jobId, newStatus);
      console.log('Customer notification sent');
    }

    // Pause or resume timer based on status
    if (newStatusObj.pausesTime) {
      // await pauseJobTimer(jobId);
      console.log('Timer paused');
    } else {
      // await resumeJobTimer(jobId);
      console.log('Timer resumed');
    }

    return res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      newStatus,
      timestamp,
      pausesTime: newStatusObj.pausesTime
    });

  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}