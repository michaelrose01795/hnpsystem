// file location: src/pages/api/status/getCurrentStatus.js

// API endpoint to get the current status of a job
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query; // Get jobId from query parameters

  // Validation
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId parameter' });
  }

  try {
    // TODO: Replace with your actual database connection
    // const db = await connectToDatabase();

    // Get current status from jobs table
    // const result = await db.query(
    //   'SELECT status, updated_at FROM jobs WHERE id = ?',
    //   [jobId]
    // );

    // Mock data for now
    const result = {
      status: 'in_progress',
      updated_at: new Date().toISOString()
    };

    // if (!result) {
    //   return res.status(404).json({ error: 'Job not found' });
    // }

    return res.status(200).json({
      success: true,
      status: result.status,
      lastUpdated: result.updated_at
    });

  } catch (error) {
    console.error('Error fetching current status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}