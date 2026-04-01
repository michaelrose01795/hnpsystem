// file location: e2e/workflows/vhc-authorization-flow.spec.js
// Linked workflow test — verifies VHC authorization flow data integrity.

const { test, expect } = require('../helpers/fixtures.js');

test.describe.serial('Linked flow — VHC authorization', () => {
  const testJobNumber = `TEST-VHC-${Date.now()}`;
  let testJobId;

  test.afterAll(async () => {
    const dbHelpers = require('../helpers/db.js');
    if (testJobId) {
      await dbHelpers.db.from('vhc_declinations').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('vhc_workflow_status').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('vhc_checks').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('jobs').delete().eq('id', testJobId);
    }
  });

  test('create job with multiple VHC items', async ({ db }) => {
    const job = await db.createTestJob({
      job_number: testJobNumber,
      status: 'In Progress',
      description: 'VHC auth flow test',
      type: 'Service',
      vhc_required: true,
    });
    testJobId = job.id;

    const { error } = await db.db
      .from('vhc_checks')
      .insert([
        {
          job_id: testJobId, section: 'Brakes', issue_title: 'Front pads critically low',
          severity: 'red', approval_status: 'pending', labour_hours: 1.0, parts_cost: 45.00,
        },
        {
          job_id: testJobId, section: 'Tyres', issue_title: 'Rear tyre advisory',
          severity: 'amber', approval_status: 'pending', labour_hours: 0.5, parts_cost: 85.00,
        },
        {
          job_id: testJobId, section: 'Lights', issue_title: 'Bulb replacement suggested',
          severity: 'grey', approval_status: 'pending', labour_hours: 0.25, parts_cost: 8.00,
        },
      ]);
    expect(error).toBeNull();
  });

  test('all VHC items start as pending', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const checks = await db.getVhcChecks(testJobId);
    expect(checks).toHaveLength(3);
    expect(checks.every(c => c.approval_status === 'pending')).toBe(true);
  });

  test('authorize red item — status updates correctly', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const checks = await db.getVhcChecks(testJobId);
    const redItem = checks.find(c => c.severity === 'red');

    const { error } = await db.db
      .from('vhc_checks')
      .update({ approval_status: 'authorized', approved_at: new Date().toISOString() })
      .eq('vhc_id', redItem.vhc_id);
    expect(error).toBeNull();

    const updated = await db.getVhcChecks(testJobId);
    const updatedRed = updated.find(c => c.severity === 'red');
    expect(updatedRed.approval_status).toBe('authorized');
    expect(updatedRed.approved_at).toBeTruthy();
  });

  test('decline amber item — status updates correctly', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const checks = await db.getVhcChecks(testJobId);
    const amberItem = checks.find(c => c.severity === 'amber');

    const { error } = await db.db
      .from('vhc_checks')
      .update({ approval_status: 'declined' })
      .eq('vhc_id', amberItem.vhc_id);
    expect(error).toBeNull();

    const updated = await db.getVhcChecks(testJobId);
    const statuses = updated.map(c => c.approval_status).sort();
    expect(statuses).toContain('authorized');
    expect(statuses).toContain('declined');
    expect(statuses).toContain('pending');
  });

  test('final VHC state summary is consistent', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const checks = await db.getVhcChecks(testJobId);

    const authorized = checks.filter(c => c.approval_status === 'authorized');
    const declined = checks.filter(c => c.approval_status === 'declined');
    const pending = checks.filter(c => c.approval_status === 'pending');

    expect(authorized).toHaveLength(1);
    expect(declined).toHaveLength(1);
    expect(pending).toHaveLength(1);

    expect(authorized[0].severity).toBe('red');
    expect(authorized[0].section).toBe('Brakes');
  });
});
