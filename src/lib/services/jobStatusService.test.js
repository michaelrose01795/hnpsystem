import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock("@/lib/database/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/database/jobs", () => ({
  updateJob: mocks.updateJob,
}));

import { autoSetBookedStatus } from "@/lib/services/jobStatusService";

describe("autoSetBookedStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateJob.mockResolvedValue({ success: true, data: { status: "Booked" } });
  });

  it("uses the acting advisor and leaves history logging to updateJob", async () => {
    const result = await autoSetBookedStatus(42, 7);

    expect(result.success).toBe(true);
    expect(mocks.updateJob).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        status: "Booked",
        status_updated_by: 7,
      })
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
