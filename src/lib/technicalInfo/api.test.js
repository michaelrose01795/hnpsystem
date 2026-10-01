import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/roleGuard", () => ({ withRoleGuard: (handler) => handler }));
vi.mock("@/lib/auth/pageAccess", () => ({ canAccessPath: vi.fn() }));
vi.mock("@/lib/database/technicalInfo", () => ({ loadTechnicalInfoContext: vi.fn() }));
vi.mock("@/lib/technicalInfo/service", () => ({ getTechnicalInformation: vi.fn() }));
import { loadTechnicalInfoContext } from "@/lib/database/technicalInfo";
import { getTechnicalInformation } from "@/lib/technicalInfo/service";
import { handler } from "@/pages/api/job-cards/[jobNumber]/technical-info";

const response = () => {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res); return res;
};
beforeEach(() => vi.clearAllMocks());
describe("technical information API validation", () => {
  it("loads identity from the URL's saved job and ignores client vehicle claims", async () => {
    const context = { job: { job_number: "00042" }, vehicle: { vin: "saved" }, requests: [] };
    loadTechnicalInfoContext.mockResolvedValue(context);
    getTechnicalInformation.mockResolvedValue({ items: [] });
    const res = response();
    await handler({ method: "POST", query: { jobNumber: "00042" }, body: { vehicle: { vin: "other" }, query: "oil capacity" } }, res);
    expect(loadTechnicalInfoContext).toHaveBeenCalledWith("00042");
    expect(getTechnicalInformation.mock.calls[0][0]).toBe(context);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  it.each([{ query: "x".repeat(201) }, { category: "invented" }, { requestId: [] }, { browse: "yes" }])("rejects invalid input %j before any database call", async (body) => {
    const res = response();
    await handler({ method: "POST", query: { jobNumber: "00042" }, body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(loadTechnicalInfoContext).not.toHaveBeenCalled();
  });
  it("rejects unsupported methods", async () => {
    const res = response();
    await handler({ method: "GET", query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
  it("returns not found without contacting providers", async () => {
    const res = response(); loadTechnicalInfoContext.mockResolvedValue(null);
    await handler({ method: "POST", query: { jobNumber: "00042" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(getTechnicalInformation).not.toHaveBeenCalled();
  });
});
