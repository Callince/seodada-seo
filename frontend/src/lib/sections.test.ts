import { describe, expect, it } from "vitest";

import { moduleForPath, moduleForSection, sectionVars } from "@/lib/sections";

describe("moduleForPath", () => {
  it("maps routes to their workflow-group accent", () => {
    expect(moduleForPath("/keywords")).toBe("keywords");
    expect(moduleForPath("/serp")).toBe("keywords"); // Research group
    expect(moduleForPath("/onpage")).toBe("audit");
    expect(moduleForPath("/rank")).toBe("rank");
    expect(moduleForPath("/ai-visibility")).toBe("rank"); // Track group
    expect(moduleForPath("/admin")).toBe("admin");
  });

  it("matches subpaths but not lookalike prefixes", () => {
    expect(moduleForPath("/projects/abc123")).toBe("manage");
    expect(moduleForPath("/rankings")).toBe("overview"); // not /rank
  });

  it("prefers the longest prefix", () => {
    expect(moduleForPath("/tools/url")).toBe("tools");
  });

  it("defaults to overview", () => {
    expect(moduleForPath("/")).toBe("overview");
    expect(moduleForPath("/nope")).toBe("overview");
  });
});

describe("moduleForSection / sectionVars", () => {
  it("maps sidebar groups and falls back to overview", () => {
    expect(moduleForSection("1 · Research")).toBe("keywords");
    expect(moduleForSection(undefined)).toBe("overview");
  });

  it("binds --section vars for a module", () => {
    expect(sectionVars("rank")).toEqual({
      "--section": "var(--sec-rank)",
      "--section-soft": "var(--sec-rank-soft)",
    });
  });
});
