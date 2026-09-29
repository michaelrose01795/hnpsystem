// file location: src/lib/email/template.test.js
//
// Links in outgoing email must point at the configured public site: never
// localhost / a private address in production, while local development still
// gets a link to the local app.

import { describe, it, expect } from "vitest";
import { isLocalOrPrivateHost, resolvePublicAppUrl } from "@/lib/email/template";

const localReq = { headers: { host: "localhost:3000" } };

describe("isLocalOrPrivateHost", () => {
  it.each(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "10.1.2.3", "192.168.0.10", "172.20.1.1", "box.local"])(
    "treats %s as local",
    (host) => expect(isLocalOrPrivateHost(host)).toBe(true)
  );
  it.each(["hnpsystem.vercel.app", "example.com", "172.32.0.1"])("treats %s as public", (host) =>
    expect(isLocalOrPrivateHost(host)).toBe(false)
  );
});

describe("resolvePublicAppUrl — production", () => {
  const prod = (extra) => ({ NODE_ENV: "production", ...extra });

  it("uses the configured public site URL", () => {
    expect(resolvePublicAppUrl(localReq, prod({ NEXT_PUBLIC_APP_URL: "https://dms.example.com/" }))).toBe(
      "https://dms.example.com"
    );
  });

  it("adds https to a bare host (as NEXTAUTH_URL is configured)", () => {
    expect(resolvePublicAppUrl(undefined, prod({ NEXTAUTH_URL: "hnpsystem.vercel.app" }))).toBe(
      "https://hnpsystem.vercel.app"
    );
  });

  it("never returns localhost even if it was configured", () => {
    const url = resolvePublicAppUrl(localReq, prod({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXTAUTH_URL: "http://127.0.0.1:3000" }));
    expect(url).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(url).toBe("https://hnpsystem.vercel.app");
  });

  it("ignores the (client-controlled) Host header", () => {
    expect(resolvePublicAppUrl({ headers: { host: "evil.example" } }, prod({}))).toBe("https://hnpsystem.vercel.app");
  });

  it("uses Vercel's production domain when nothing else is set", () => {
    expect(resolvePublicAppUrl(undefined, prod({ VERCEL_PROJECT_PRODUCTION_URL: "dms.example.com" }))).toBe(
      "https://dms.example.com"
    );
  });
});

describe("resolvePublicAppUrl — development", () => {
  const dev = (extra) => ({ NODE_ENV: "development", ...extra });

  it("links to the local app the request came in on", () => {
    expect(resolvePublicAppUrl(localReq, dev({ NEXTAUTH_URL: "hnpsystem.vercel.app" }))).toBe("http://localhost:3000");
  });

  it("still honours an explicit public site URL (e.g. a tunnel)", () => {
    expect(resolvePublicAppUrl(localReq, dev({ NEXT_PUBLIC_APP_URL: "https://abc.ngrok.app" }))).toBe(
      "https://abc.ngrok.app"
    );
  });

  it("falls back to localhost:3000 with no request", () => {
    expect(resolvePublicAppUrl(undefined, dev({}))).toBe("http://localhost:3000");
  });
});
