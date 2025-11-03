// ✅ File location: src/lib/database/jobs.js

// This file handles all database operations for job cards
// It connects to your database and provides functions to create, read, update, and delete job cards

import { openDB } from './db'; // Import the database connection helper

/* ============================================
   GET JOB BY JOB NUMBER OR REGISTRATION
============================================= */
// This function retrieves a job card by either job number or vehicle registration
export async function getJobByNumberOrReg(identifier) {
  try {
    const db = await openDB(); // Open database connection
    
    // Try to find job by job number first
    let job = await db.get(
      'SELECT * FROM jobs WHERE jobNumber = ?',
      [identifier]
    );
    
    // If not found, try by registration number
    if (!job) {
      job = await db.get(
        'SELECT * FROM jobs WHERE registration = ?',
        [identifier]
      );
    }
    
    // If job found, parse the JSON fields
    if (job) {
      // Parse vhcChecks if it exists and is a string
      if (job.vhcChecks && typeof job.vhcChecks === 'string') {
        job.vhcChecks = JSON.parse(job.vhcChecks);
      }
      // Parse other JSON fields as needed
      if (job.parts && typeof job.parts === 'string') {
        job.parts = JSON.parse(job.parts);
      }
    }
    
    return job; // Return the job object or null if not found
  } catch (error) {
    console.error('❌ Error getting job:', error);
    throw error;
  }
}

/* ============================================
   SAVE VHC CHECKSHEET DATA
============================================= */
// This function saves or updates the VHC (Vehicle Health Check) data for a job card
export async function saveChecksheet(jobNumber, vhcData) {
  try {
    const db = await openDB(); // Open database connection
    
    // First, get the existing job to retrieve current vhcChecks
    const job = await getJobByNumberOrReg(jobNumber);
    
    if (!job) {
      return { success: false, error: 'Job not found' }; // Return error if job doesn't exist
    }
    
    // Create or update vhcChecks array
    let vhcChecks = job.vhcChecks || []; // Get existing checks or create empty array
    
    // Create new VHC entry with timestamp
    const newVhcEntry = {
      timestamp: new Date().toISOString(), // Current date/time in ISO format
      data: vhcData, // The VHC data being saved
      completedBy: 'current-user', // TODO: Replace with actual user from session/auth
    };
    
    // Check if there's already a VHC entry for today
    const todayDate = new Date().toISOString().split('T')[0]; // Get today's date (YYYY-MM-DD)
    const existingIndex = vhcChecks.findIndex(check => 
      check.timestamp.startsWith(todayDate) // Find entry from today
    );
    
    if (existingIndex >= 0) {
      // Update existing entry for today
      vhcChecks[existingIndex] = newVhcEntry;
    } else {
      // Add new entry
      vhcChecks.push(newVhcEntry);
    }
    
    // Update the job in database with new vhcChecks
    await db.run(
      'UPDATE jobs SET vhcChecks = ?, updatedAt = ? WHERE jobNumber = ?',
      [JSON.stringify(vhcChecks), new Date().toISOString(), jobNumber]
    );
    
    return { success: true }; // Return success response
  } catch (error) {
    console.error('❌ Error saving checksheet:', error);
    return { success: false, error: error.message }; // Return error response
  }
}

/* ============================================
   GET ALL JOBS (WITH OPTIONAL FILTERS)
============================================= */
// This function retrieves all jobs with optional filtering
export async function getAllJobs(filters = {}) {
  try {
    const db = await openDB(); // Open database connection
    
    let query = 'SELECT * FROM jobs WHERE 1=1'; // Base query (1=1 allows easy appending of conditions)
    const params = []; // Array to hold query parameters
    
    // Apply filters if provided
    if (filters.status) {
      query += ' AND status = ?'; // Add status filter
      params.push(filters.status);
    }
    
    if (filters.department) {
      query += ' AND department = ?'; // Add department filter
      params.push(filters.department);
    }
    
    // Order by most recent first
    query += ' ORDER BY createdAt DESC';
    
    const jobs = await db.all(query, params); // Execute query and get all results
    
    // Parse JSON fields for each job
    return jobs.map(job => {
      if (job.vhcChecks && typeof job.vhcChecks === 'string') {
        job.vhcChecks = JSON.parse(job.vhcChecks);
      }
      if (job.parts && typeof job.parts === 'string') {
        job.parts = JSON.parse(job.parts);
      }
      return job;
    });
  } catch (error) {
    console.error('❌ Error getting all jobs:', error);
    throw error;
  }
}

/* ============================================
   CREATE NEW JOB CARD
============================================= */
// This function creates a new job card in the database
export async function createJob(jobData) {
  try {
    const db = await openDB(); // Open database connection
    
    // Generate job number (you may want a different format)
    const jobNumber = `JOB-${Date.now()}`; // Simple timestamp-based job number
    
    const result = await db.run(
      `INSERT INTO jobs (
        jobNumber, 
        registration, 
        customerName, 
        customerPhone, 
        customerEmail,
        vehicleMake,
        vehicleModel,
        status,
        department,
        description,
        vhcChecks,
        parts,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobNumber,
        jobData.registration,
        jobData.customerName,
        jobData.customerPhone || null,
        jobData.customerEmail || null,
        jobData.vehicleMake || null,
        jobData.vehicleModel || null,
        jobData.status || 'pending',
        jobData.department || 'workshop',
        jobData.description || '',
        JSON.stringify([]), // Empty VHC checks array
        JSON.stringify([]), // Empty parts array
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    
    return { success: true, jobNumber, id: result.lastID }; // Return success with job details
  } catch (error) {
    console.error('❌ Error creating job:', error);
    return { success: false, error: error.message };
  }
}

/* ============================================
   UPDATE JOB STATUS
============================================= */
// This function updates the status of a job card
export async function updateJobStatus(jobNumber, newStatus) {
  try {
    const db = await openDB(); // Open database connection
    
    await db.run(
      'UPDATE jobs SET status = ?, updatedAt = ? WHERE jobNumber = ?',
      [newStatus, new Date().toISOString(), jobNumber]
    );
    
    return { success: true }; // Return success response
  } catch (error) {
    console.error('❌ Error updating job status:', error);
    return { success: false, error: error.message };
  }
}

/* ============================================
   DELETE JOB FILE/ATTACHMENT
============================================= */
// This function deletes a file attachment from a job card
export async function deleteJobFile(jobNumber, fileId) {
  try {
    const db = await openDB(); // Open database connection
    
    // Get the job to access its files
    const job = await getJobByNumberOrReg(jobNumber);
    
    if (!job) {
      return { success: false, error: 'Job not found' };
    }
    
    // Parse files if stored as JSON
    let files = job.files || [];
    if (typeof files === 'string') {
      files = JSON.parse(files);
    }
    
    // Filter out the file to delete
    files = files.filter(file => file.id !== fileId);
    
    // Update job with new files array
    await db.run(
      'UPDATE jobs SET files = ?, updatedAt = ? WHERE jobNumber = ?',
      [JSON.stringify(files), new Date().toISOString(), jobNumber]
    );
    
    // TODO: Also delete the physical file from storage if needed
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting job file:', error);
    return { success: false, error: error.message };
  }
}
