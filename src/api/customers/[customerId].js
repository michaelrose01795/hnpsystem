// ✅ File location: src/pages/api/customers/[customerId].js
import { getCustomerById, updateCustomer, getCustomerVehicles } from "@/lib/database/customers";
import { getAllJobs } from "@/lib/database/jobs";

/**
 * API endpoint for customer operations
 * GET /api/customers/[customerId] - Get customer details with jobs
 * PUT /api/customers/[customerId] - Update customer
 */
export default async function handler(req, res) {
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID required' });
  }

  try {
    // GET - Fetch customer with their jobs
    if (req.method === 'GET') {
      console.log('🔍 Fetching customer:', customerId);

      const customer = await getCustomerById(customerId);

      if (!customer) {
        return res.status(404).json({ 
          message: `Customer ${customerId} not found` 
        });
      }

      // Get all jobs for this customer
      const allJobs = await getAllJobs();
      const customerJobs = allJobs.filter(job => {
        // Check if job's customer ID matches
        return job.vehicle?.customer?.id === parseInt(customerId);
      });

      // Get customer's vehicles
      const vehicles = await getCustomerVehicles(customerId);

      console.log('✅ Customer found with', customerJobs.length, 'jobs');

      return res.status(200).json({
        customer: {
          customerId: customer.id,
          firstname: customer.firstname,
          lastname: customer.lastname,
          email: customer.email,
          mobile: customer.mobile,
          telephone: customer.telephone,
          address: customer.address,
          postcode: customer.postcode,
          createdAt: customer.created_at
        },
        totalJobs: customerJobs.length,
        jobs: customerJobs.map(job => ({
          jobNumber: job.jobNumber,
          type: job.type,
          status: job.status,
          description: job.description,
          reg: job.reg,
          make: job.make,
          model: job.model,
          appointment: job.appointment
        })),
        vehicles: vehicles.map(v => ({
          vehicleId: v.vehicle_id,
          reg: v.reg_number,
          make: v.make,
          model: v.model,
          year: v.year,
          colour: v.colour
        }))
      });
    }

    // PUT - Update customer
    if (req.method === 'PUT') {
      console.log('🔄 Updating customer:', customerId);

      const result = await updateCustomer(customerId, req.body);

      if (!result.success) {
        return res.status(400).json({ 
          message: 'Failed to update customer',
          error: result.error.message 
        });
      }

      return res.status(200).json({ 
        message: 'Customer updated successfully',
        customer: result.data 
      });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Customer API error:', error);
    return res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
}