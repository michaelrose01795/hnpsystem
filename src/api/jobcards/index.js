// ✅ File location: src/pages/api/jobcards/index.js
import { getAllJobs, addJobToDatabase } from "@/lib/database/jobs";

/**
 * API endpoint for job cards list with filtering
 * GET /api/jobcards?status=In Progress&source=Walk-in&category=Service
 * POST /api/jobcards - Create new job card
 */
export default async function handler(req, res) {
  try {
    // GET - Fetch all job cards with optional filters
    if (req.method === 'GET') {
      const { status, source, category, division } = req.query;

      console.log('🔍 Fetching job cards with filters:', { status, source, category });

      // Get all jobs from database
      let jobCards = await getAllJobs();

      // Apply filters if provided
      if (status) {
        jobCards = jobCards.filter(j => 
          j.status?.toLowerCase() === status.toLowerCase()
        );
        console.log(`📊 Filtered by status "${status}":`, jobCards.length, 'jobs');
      }

      if (source) {
        jobCards = jobCards.filter(j => 
          j.jobSource?.toLowerCase() === source.toLowerCase()
        );
        console.log(`📊 Filtered by source "${source}":`, jobCards.length, 'jobs');
      }

      if (category) {
        jobCards = jobCards.filter(j => 
          j.jobCategories?.includes(category) || 
          j.type?.toLowerCase() === category.toLowerCase()
        );
        console.log(`📊 Filtered by category "${category}":`, jobCards.length, 'jobs');
      }

      if (division) {
        jobCards = jobCards.filter((j) =>
          (j.jobDivision || "Retail")?.toLowerCase() === division.toLowerCase()
        );
        console.log(`📊 Filtered by division "${division}":`, jobCards.length, 'jobs');
      }

      console.log('✅ Returning', jobCards.length, 'job cards');

      return res.status(200).json({
        total: jobCards.length,
        jobCards,
        filters: {
          status: status || null,
          source: source || null,
          category: category || null,
          division: division || null
        }
      });
    }

    // POST - Create new job card
    if (req.method === 'POST') {
      console.log('➕ Creating new job card');

      const { 
        jobNumber, 
        reg, 
        customerId, 
        assignedTo, 
        type, 
        description,
        jobSource,
        jobDivision,
        jobCategories 
      } = req.body;

      // Validate required fields
      if (!jobNumber || !reg) {
        return res.status(400).json({ 
          message: 'Job number and registration are required' 
        });
      }

      const result = await addJobToDatabase({
        jobNumber,
        reg,
        customerId,
        assignedTo,
        type: type || 'Service',
        description,
        jobSource,
        jobDivision,
        jobCategories
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.error.message || 'Failed to create job card',
          error: result.error 
        });
      }

      console.log('✅ Job card created:', result.data.jobNumber);

      return res.status(201).json({ 
        message: 'Job card created successfully',
        jobCard: result.data 
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Job cards API error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
}
