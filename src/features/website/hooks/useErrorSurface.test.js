import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import useErrorSurface from "@/features/website/hooks/useErrorSurface";

const router = vi.hoisted(() => ({ asPath: "/404" }));
vi.mock("next/router", () => ({ useRouter: () => router }));

function ErrorSurfaceProbe() {
  const surface = useErrorSurface();
  return surface === null ? null : createElement("div", null, surface);
}

describe("error surface hydration", () => {
  it.each(["/404", "/500", "/_error"])(
    "keeps %s markup identical when the client knows the requested address",
    (serverPath) => {
      router.asPath = serverPath;
      const serverMarkup = renderToString(createElement(ErrorSurfaceProbe));
      expect(serverMarkup).toBe("");

      for (const requestedPath of ["/missing-staff-page", "/website/missing", "/website?test=1", ""]) {
        router.asPath = requestedPath;
        // Server rendering skips effects, matching the pre-effect hydration render.
        expect(renderToString(createElement(ErrorSurfaceProbe))).toBe(serverMarkup);
      }
    }
  );
});
