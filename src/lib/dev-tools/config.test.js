import { describe, expect, it } from "vitest";
import {
  canShowDeveloperOnlyControls,
  isDevelopmentBranch,
} from "@/lib/dev-tools/config";

describe("developer-only branch controls", () => {
  it("shows controls on the development branch", () => {
    const env = { NEXT_PUBLIC_COMMIT_REF: "development" };

    expect(isDevelopmentBranch(env)).toBe(true);
    expect(canShowDeveloperOnlyControls(env)).toBe(true);
  });

  it("accepts a fully qualified development branch ref", () => {
    expect(
      isDevelopmentBranch({ NEXT_PUBLIC_COMMIT_REF: "refs/heads/development" })
    ).toBe(true);
  });

  it("hides controls on the main production branch", () => {
    const env = { NEXT_PUBLIC_COMMIT_REF: "main" };

    expect(isDevelopmentBranch(env)).toBe(false);
    expect(canShowDeveloperOnlyControls(env)).toBe(false);
  });

  it("fails closed when branch metadata is unavailable", () => {
    expect(isDevelopmentBranch({})).toBe(false);
    expect(canShowDeveloperOnlyControls({})).toBe(false);
  });

  it("falls back to Vercel branch metadata", () => {
    expect(isDevelopmentBranch({ VERCEL_GIT_COMMIT_REF: "development" })).toBe(true);
  });
});
