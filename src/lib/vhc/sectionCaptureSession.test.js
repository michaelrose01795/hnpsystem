import { describe, expect, it, vi } from "vitest";
import {
  buildCaptureConcernLink,
  uploadSectionCaptureQueue,
} from "@/lib/vhc/sectionCaptureSession";

describe("sectionCaptureSession", () => {
  it("normalises the selected VHC concern for every queued upload", () => {
    expect(
      buildCaptureConcernLink({
        section: "Wheels & Tyres",
        category: "NSF",
        categoryLabel: "Nearside front",
        concernId: "wheels-nsf-0",
        index: 0,
        label: "Low tread",
        status: "amber",
      }),
    ).toEqual({
      section: "Wheels & Tyres",
      category: "NSF",
      categoryLabel: "Nearside front",
      concernId: "wheels-nsf-0",
      index: 0,
      label: "Low tread",
      status: "amber",
    });
  });

  it("uploads the full queue and reports individual failures without losing successful files", async () => {
    const firstFile = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const secondFile = new File(["second"], "second.jpg", { type: "image/jpeg" });
    const uploadFile = vi
      .fn()
      .mockResolvedValueOnce({ file_id: 41 })
      .mockRejectedValueOnce(new Error("network error"));

    const result = await uploadSectionCaptureQueue({
      items: [
        { id: "one", file: firstFile, type: "photo" },
        { id: "two", file: secondFile, type: "photo" },
      ],
      uploadFile,
      uploadContext: { jobId: 123, jobNumber: "03969", userId: 7 },
      concern: {
        section: "Wheels & Tyres",
        concernId: "wheels-nsf-0",
        label: "Low tread",
        status: "amber",
      },
    });

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(uploadFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        file: firstFile,
        jobId: 123,
        visibleToCustomer: true,
        concernLink: expect.objectContaining({ concernId: "wheels-nsf-0" }),
      }),
    );
    expect(result.saved).toEqual([{ itemId: "one", file: { file_id: 41 } }]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ itemId: "two", item: { file: secondFile } });
    expect(result.failed[0].error.message).toBe("network error");
  });
});
