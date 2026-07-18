import { describe, expect, it } from "vitest";

import { dfsLocationName } from "@/lib/regionNames";

describe("dfsLocationName", () => {
  it("names DataForSEO country codes", () => {
    expect(dfsLocationName(2356)).toBe("India");
    expect(dfsLocationName(2840)).toBe("United States");
    expect(dfsLocationName(2826)).toBe("United Kingdom");
    expect(dfsLocationName(2682)).toBe("Saudi Arabia");
    expect(dfsLocationName(2784)).toBe("United Arab Emirates");
    expect(dfsLocationName("2036")).toBe("Australia");
  });

  it("falls back to the raw code for city codes and unknowns", () => {
    expect(dfsLocationName(1007809)).toBe("1007809"); // Chennai (city-level)
    expect(dfsLocationName(null)).toBe("—");
    expect(dfsLocationName("weird")).toBe("weird");
  });
});
