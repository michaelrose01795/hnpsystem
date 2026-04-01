// file location: e2e/workflows/job-parts-linked.spec.js
// Linked workflow test — verifies parts data flows correctly between
// job card, parts pipeline, and database.

const { test, expect } = require('../helpers/fixtures.js');

test.describe.serial('Linked flow — Job + Parts pipeline', () => {
  const testJobNumber = `TEST-PARTS-${Date.now()}`;
  let testJobId;
  let testVhcId;

  test.afterAll(async () => {
    const dbHelpers = require('../helpers/db.js');
    if (testJobId) {
      await dbHelpers.db.from('parts_job_items').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('vhc_checks').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('job_requests').delete().eq('job_id', testJobId);
      await dbHelpers.db.from('jobs').delete().eq('id', testJobId);
    }
  });

  test('set up job with VHC item', async ({ db }) => {
    const job = await db.createTestJob({
      job_number: testJobNumber,
      status: 'In Progress',
      description: 'Parts flow test',
      type: 'Service',
    });
    testJobId = job.id;

    const { data: vhcData, error } = await db.db
      .from('vhc_checks')
      .insert({
        job_id: testJobId, section: 'Brakes', issue_title: 'Front brake pads worn',
        severity: 'red', labour_hours: 1.0, parts_cost: 45.00, approval_status: 'authorized',
      })
      .select()
      .single();

    expect(error).toBeNull();
    testVhcId = vhcData.vhc_id;
  });

  test('parts linked to VHC maintain relationship', async ({ db }) => {
    test.skip(!testJobId || !testVhcId, 'No test data');

    // parts_job_items requires a part_id (FK to parts_catalog)
    // Use a deterministic UUID for test data
    const testPartId = '00000000-0000-0000-0000-000000000099';

    // Ensure the test part exists in parts_catalog
    // Ensure the test part exists in parts_catalog (column is 'name', not 'part_name')
    await db.db.from('parts_catalog').upsert({
      id: testPartId, part_number: 'TEST-BP-001',
      name: 'Brake Pad Set - Front', unit_cost: 25.00, unit_price: 45.00,
    }, { onConflict: 'id' });

    const { data: part, error } = await db.db
      .from('parts_job_items')
      .insert({
        job_id: testJobId, vhc_item_id: testVhcId, part_id: testPartId,
        quantity_requested: 1, unit_cost: 25.00, unit_price: 45.00,
        status: 'pending', origin: 'VHC',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(part.vhc_item_id).toBe(testVhcId);
    expect(part.origin).toBe('VHC');
  });

  test('part status progression is tracked', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const parts = await db.getJobParts(testJobId);
    expect(parts).toHaveLength(1);

    const partId = parts[0].id;

    for (const status of ['on_order', 'pre_picked', 'fitted']) {
      const { error } = await db.db
        .from('parts_job_items')
        .update({ status })
        .eq('id', partId);
      expect(error).toBeNull();
    }

    const updatedParts = await db.getJobParts(testJobId);
    expect(updatedParts[0].status).toBe('fitted');
  });

  test('parts quantity and pricing are consistent', async ({ db }) => {
    test.skip(!testJobId, 'No test data');

    const parts = await db.getJobParts(testJobId);
    const part = parts[0];

    expect(Number(part.unit_cost)).toBe(25.00);
    expect(Number(part.unit_price)).toBe(45.00);
    expect(part.quantity_requested).toBe(1);

    const { error } = await db.db
      .from('parts_job_items')
      .update({ quantity_allocated: 1, quantity_fitted: 1 })
      .eq('id', part.id);
    expect(error).toBeNull();

    const updated = await db.getJobParts(testJobId);
    expect(updated[0].quantity_allocated).toBe(1);
    expect(updated[0].quantity_fitted).toBe(1);
  });
});
