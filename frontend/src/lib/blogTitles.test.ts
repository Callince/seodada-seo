import { describe, expect, it } from "vitest";

import { extractTheme, generateTitles } from "@/lib/blogTitles";

describe("extractTheme", () => {
  it("uses a short single line verbatim", () => {
    expect(extractTheme("electric scooters in india")).toBe("electric scooters in india");
  });

  it("reduces a multi-line outline to its most repeated phrase", () => {
    // Users paste outlines, not keywords — this is why the Flask original had a
    // theme extractor rather than slotting the raw input into a template.
    const outline = [
      "best electric scooter for city commuting",
      "electric scooter battery range explained",
      "electric scooter maintenance tips",
    ].join("\n");
    expect(extractTheme(outline).toLowerCase()).toContain("electric scooter");
  });

  it("falls back to the top word when no bigram repeats", () => {
    expect(extractTheme("alpha\nbeta\ngamma").length).toBeGreaterThan(0);
  });

  it("ignores stop words when picking the theme", () => {
    const theme = extractTheme("the of and\nthe of and\nkeyword research keyword research");
    expect(theme.toLowerCase()).toContain("keyword research");
  });

  it("never returns an empty string for non-empty input", () => {
    for (const input of ["a", "  x  ", "the", "one two"]) {
      expect(generateTitles({ topic: input, style: "seo", tone: "formal", count: 1 }).length).toBe(1);
    }
  });
});

describe("generateTitles", () => {
  const base = { topic: "keyword research", style: "seo" as const, tone: "formal" as const };

  it("returns the requested count", () => {
    expect(generateTitles({ ...base, count: 5 })).toHaveLength(5);
  });

  it("clamps the count to 1..10", () => {
    expect(generateTitles({ ...base, count: 0 })).toHaveLength(1);
    expect(generateTitles({ ...base, count: 99 })).toHaveLength(10);
  });

  it("returns distinct titles", () => {
    const out = generateTitles({ ...base, count: 10 });
    expect(new Set(out).size).toBe(out.length);
  });

  it("puts the theme in every title", () => {
    for (const t of generateTitles({ ...base, count: 8 })) {
      expect(t.toLowerCase()).toContain("keyword research");
    }
  });

  it("prefers the focus keyword over the topic", () => {
    const out = generateTitles({
      ...base, topic: "some rambling topic", focusKeyword: "link building", count: 3,
    });
    for (const t of out) expect(t.toLowerCase()).toContain("link building");
  });

  it("respects the chosen style", () => {
    const listicles = generateTitles({ ...base, style: "listicle", count: 6 });
    // Every listicle template opens with, or contains, a number.
    for (const t of listicles) expect(t).toMatch(/\d/);

    // Interrogative *opening*, not a trailing "?": one template inherited from
    // the Flask original is "What Every Professional Should Know About X Before
    // It's Too Late" — a real title in that style with no question mark. An
    // assertion on "?" passes or fails depending on the shuffle.
    const questions = generateTitles({ ...base, style: "question", count: 12 });
    for (const t of questions) {
      expect(t).toMatch(/^(What|Why|How|Is|Are|Can|Does|Do|Should|Will)\b/);
    }
  });

  it("mixed draws on more than one style", () => {
    // Aggregated over runs on purpose. Only 11 of the 60 mixed templates carry
    // a "?", so a single 10-title draw legitimately misses them about one time
    // in six — asserting on one sample made this test fail ~15% of the time.
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      for (const t of generateTitles({ ...base, style: "mixed", count: 10 })) {
        seen.add(t.includes("?") ? "question" : "statement");
      }
    }
    expect([...seen].sort()).toEqual(["question", "statement"]);
  });

  it("derives the year instead of hardcoding it", () => {
    // The Flask templates baked in "2026", which dates every generated title
    // the moment the year turns.
    // Aggregated over runs on purpose: only 2 of the 12 how_to templates carry a
    // year and `count` is capped at 10, so a single draw can legitimately exclude
    // both. Asserting on one draw made this flake.
    const withYear: string[] = [];
    for (let i = 0; i < 20; i++) {
      const out = generateTitles({ ...base, style: "how_to", count: 10, year: 2031 });
      expect(out.join(" ")).not.toContain("2026");
      withYear.push(...out.filter((t) => /\b20\d\d\b/.test(t)));
    }
    expect(withYear.length).toBeGreaterThan(0);
    for (const t of withYear) expect(t).toContain("2031");
  });

  it("tone visibly changes the output", () => {
    // The Flask version accepted a tone and then ignored it, so the control did
    // nothing. Urgent must actually differ from formal.
    const formal = generateTitles({ ...base, style: "how_to", tone: "formal", count: 10, year: 2030 });
    const urgent = generateTitles({ ...base, style: "how_to", tone: "urgent", count: 10, year: 2030 });
    expect(urgent.some((t) => t.endsWith("Start Today"))).toBe(true);
    expect(formal.some((t) => t.endsWith("Start Today"))).toBe(false);
  });

  it("returns nothing for empty input", () => {
    expect(generateTitles({ ...base, topic: "   ", count: 5 })).toEqual([]);
  });
});
