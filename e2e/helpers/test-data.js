// file location: e2e/helpers/test-data.js
// Test data factories for repeatable E2E test scenarios.

/** Generate a unique test job number */
function testJobNumber(suffix = '') {
  return `TEST-${Date.now()}${suffix ? `-${suffix}` : ''}`;
}

/** Minimal customer data for job creation */
const testCustomer = {
  title: 'Mr',
  first_name: 'Test',
  last_name: 'Customer',
  email: `test-${Date.now()}@example.com`,
  phone: '07700900000',
  address_line_1: '1 Test Street',
  postcode: 'TE1 1ST',
};

/** Minimal vehicle data for job creation */
const testVehicle = {
  registration: `TEST${Date.now().toString().slice(-4)}`,
  make: 'Toyota',
  model: 'Corolla',
  year: 2022,
  colour: 'Silver',
  fuel_type: 'Petrol',
  mileage: 25000,
};

/** Standard job request descriptions */
const testJobRequests = {
  fullService: { description: 'Full service', hours: 2.0, job_type: 'Customer' },
  brakeInspection: { description: 'Brake pad inspection and replacement', hours: 1.5, job_type: 'Customer' },
  motTest: { description: 'MOT test', hours: 0.75, job_type: 'MOT' },
};

/** Standard VHC check items */
const testVhcItems = {
  brakeWear: {
    section: 'Brakes', issue_title: 'Front brake pads worn',
    measurement: '1.5mm', severity: 'red', labour_hours: 1.0, parts_cost: 45.00,
  },
  tyreDepth: {
    section: 'Tyres', issue_title: 'Rear nearside tyre low tread',
    measurement: '2.0mm', severity: 'amber', labour_hours: 0.5, parts_cost: 85.00,
  },
};

module.exports = { testJobNumber, testCustomer, testVehicle, testJobRequests, testVhcItems };
