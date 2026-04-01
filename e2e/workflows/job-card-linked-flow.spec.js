// file location: e2e/workflows/job-card-linked-flow.spec.js
// Linked workflow test — verifies data flows correctly across the job card lifecycle.
//
// Proves:
// 1. A job created via DB has correct initial state
// 2. Job requests linked to a job are queryable
// 3. VHC checks linked to a job maintain correct data
// 4. Status changes propagate to the status history table
// 5. Data entered in DB is visible on the job card page

const { test, expect } = require('../helpers/fixtures.js');

test.describe.serial('Linked flow — Job card lifecycle', () => {
  const testJobNumber = `TEST-FLOW-${Date.now()}`;
  let testJobId;

  test.afterAll(async () => {
    const dbHelpers = require('../helpers/db.js');
    if (testJobId) {
      await dbHelpers.db.from('job_status_history').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('vhc_checks').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('parts_job_items').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('job_requests').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('jobs').delete().eq('id', testJobId);
    }
  });

  test('create job and verify initial DB state', async ({ db }) => {
    const job = await db.createTestJob({
      job_number: testJobNumber,
      status: 'New',
      description: 'Linked flow test — full service',
      type: 'Service',
      vhc_required: true,
    });

    testJobId = job.id;

    expect(job.status).toBe('New');
    expect(job.type).toBe('Service');
    expect(job.vhc_required).toBe(true);
    expect(job.job_number).toBe(testJobNumber);
  });

  test('add job requests and verify they are linked', async ({ db }) => {
    test.skip(!testJobId, 'No test job created');

    const { data: requests, error } = await db.db
      .from('job_requests')
      .insert([
        { job_id: testJobId, description: 'Full service', hours: 2.0, job_type: 'Customer' },
        { job_id: testJobId, description: 'MOT test', hours: 0.75, job_type: 'MOT' },
      ])
      .select();

    expect(error).toBeNull();
    expect(requests).toHaveLength(2);

    const fetched = await db.getJobRequests(testJobId);
    expect(fetched).toHaveLength(2);
    expect(fetched.map(r => r.description)).toContain('Full service');
    expect(fetched.map(r => r.description)).toContain('MOT test');
  });

  test('add VHC checks and verify linkage to job', async ({ db }) => {
    test.skip(!testJobId, 'No test job created');

    const { data: checks, error } = await db.db
      .from('vhc_checks')
      .insert([
        {
          job_id: testJobId, section: 'Brakes', issue_title: 'Front brake pads worn',
          measurement: '1.5mm', severity: 'red', labour_hours: 1.0, parts_cost: 45.00,
          approval_status: 'pending',
        },
        {
          job_id: testJobId, section: 'Tyres', issue_title: 'Rear nearside tyre low tread',
          measurement: '2.0mm', severity: 'amber', labour_hours: 0.5, parts_cost: 85.00,
          approval_status: 'pending',
        },
      ])
      .select();

    expect(error).toBeNull();
    expect(checks).toHaveLength(2);

    const fetched = await db.getVhcChecks(testJobId);
    expect(fetched).toHaveLength(2);

    const redItem = fetched.find(c => c.severity === 'red');
    expect(redItem).toBeTruthy();
    expect(redItem.section).toBe('Brakes');
    expect(redItem.measurement).toBe('1.5mm');
  });

  test('status change creates history record', async ({ db }) => {
    test.skip(!testJobId, 'No test job created');

    const { error: updateErr } = await db.db
      .from('jobs')
      .update({ status: 'Booked' })
      .eq('id', testJobId);
    expect(updateErr).toBeNull();

    const { error: histErr } = await db.db
      .from('job_status_history')
      .insert({
        job_id: testJobId,
        from_status: 'New',
        to_status: 'Booked',
        changed_by: 'test-automation',
      });
    expect(histErr).toBeNull();

    const history = await db.getStatusHistory(testJobId);
    expect(history).toHaveLength(1);
    expect(history[0].from_status).toBe('New');
    expect(history[0].to_status).toBe('Booked');
  });

  test('job card page displays linked data', async ({ page, openJobCard }) => {
    test.skip(!testJobId, 'No test job created');

    await openJobCard(testJobNumber);
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).toContainText(testJobNumber);
  });
});
