import { describe, expect, it } from "vitest";
import {
  canShowDevOverlay,
  canShowDevPages,
  canShowDeveloperOnlyControls,
  isDevelopmentBranch,
  isDeveloperOnlyEnvironment,
} from "@/lib/dev-tools/config";

describe("developer-only branch controls", () => {
  it("shows controls on the development branch", () => {
    const env = { NEXT_PUBLIC_COMMIT_REF: "development" };

    expect(isDevelopmentBranch(env)).toBe(true);
    expect(canShowDeveloperOnlyControls(env)).toBe(true);
    expect(canShowDevPages(env)).toBe(true);
    expect(canShowDevOverlay({ id: 1 }, env)).toBe(true);
  });

  it("accepts a fully qualified development branch ref", () => {
    expect(
      isDevelopmentBranch({ NEXT_PUBLIC_COMMIT_REF: "refs/heads/development" })
    ).toBe(true);
  });

  it("hides controls on the main production branch", () => {
    const env = {
      NEXT_PUBLIC_COMMIT_REF: "main",
      NEXT_PUBLIC_DEPLOY_ENV: "production",
      NODE_ENV: "production",
    };

    expect(isDevelopmentBranch(env)).toBe(false);
    expect(canShowDeveloperOnlyControls(env)).toBe(false);
    expect(canShowDevPages(env)).toBe(false);
    expect(canShowDevOverlay({ id: 1 }, env)).toBe(false);
  });

  it("shows controls in a Vercel Preview build even though NODE_ENV is production", () => {
    const env = {
      NEXT_PUBLIC_DEPLOY_ENV: "preview",
      NODE_ENV: "production",
    };

    expect(isDeveloperOnlyEnvironment(env)).toBe(true);
    expect(canShowDeveloperOnlyControls(env)).toBe(true);
    expect(canShowDevOverlay({ id: 1 }, env)).toBe(true);
  });

  it("shows controls during local Next.js development without branch metadata", () => {
    const env = { NODE_ENV: "development" };

    expect(isDeveloperOnlyEnvironment(env)).toBe(true);
    expect(canShowDeveloperOnlyControls(env)).toBe(true);
  });

  it("hides controls when main is checked out during local development", () => {
    const env = {
      NEXT_PUBLIC_COMMIT_REF: "main",
      NEXT_PUBLIC_DEPLOY_ENV: "development",
      NODE_ENV: "development",
    };

    expect(isDeveloperOnlyEnvironment(env)).toBe(false);
    expect(canShowDeveloperOnlyControls(env)).toBe(false);
    expect(canShowDevOverlay({ id: 1 }, env)).toBe(false);
  });

  it("keeps an explicit Production deployment hidden even on the development branch", () => {
    const env = {
      NEXT_PUBLIC_COMMIT_REF: "development",
      VERCEL_ENV: "production",
      NODE_ENV: "production",
    };

    expect(isDevelopmentBranch(env)).toBe(true);
    expect(isDeveloperOnlyEnvironment(env)).toBe(false);
    expect(canShowDeveloperOnlyControls(env)).toBe(false);
  });

  it("fails closed when branch metadata is unavailable", () => {
    expect(isDevelopmentBranch({})).toBe(false);
    expect(canShowDeveloperOnlyControls({})).toBe(false);
  });

  it("falls back to Vercel branch metadata", () => {
    const env = { VERCEL_GIT_COMMIT_REF: "development" };

    expect(isDevelopmentBranch(env)).toBe(true);
    expect(canShowDevPages(env)).toBe(true);
    expect(canShowDevOverlay({ id: 1 }, env)).toBe(true);
  });

  it("requires an authenticated user before showing the overlay control", () => {
    const env = { NEXT_PUBLIC_COMMIT_REF: "development" };

    expect(canShowDevOverlay(null, env)).toBe(false);
  });
});
