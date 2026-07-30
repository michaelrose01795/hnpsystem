import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/audit/device";

describe("parseUserAgent", () => {
  it("detects a mobile browser", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36"
    );
    expect(result.deviceCategory).toBe("mobile");
    expect(result.operatingSystem).toBe("Android 14");
    expect(result.browserName).toBe("Chrome");
    expect(result.browserVersion).toBe("126.0.0.0");
  });

  it("uses client hints to distinguish a touch laptop", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      { maxTouchPoints: 10, screenWidth: 1440 }
    );
    expect(result.deviceCategory).toBe("laptop");
    expect(result.operatingSystem).toBe("Windows 10.0");
  });
});
