import { describe, expect, it } from "vitest";

import {
  analyze, computeScore, countKeyword, countSyllables, fleschReadingEase,
  getParagraphsFromHtml, getSentences, wordCount, type Check,
} from "@/lib/contentCheck";

const base = { keyword: "", seoTitle: "", metaDescription: "", slug: "" };
const find = (checks: Check[], id: string) => checks.find((c) => c.id === id)!;

/** n sentences of exactly `wordsEach` words, so word/sentence counts are exact. */
const sentences = (n: number, wordsEach = 5) =>
  Array.from({ length: n }, () => `${Array(wordsEach).fill("word").join(" ")}.`).join(" ");

describe("primitives", () => {
  it("counts words ignoring extra whitespace", () => {
    expect(wordCount("  one   two \n three ")).toBe(3);
    expect(wordCount("   ")).toBe(0);
  });

  it("splits sentences on . ! ? and drops empties", () => {
    expect(getSentences("One two. Three four! Five six?  ")).toHaveLength(3);
  });

  it("counts keyword as a whole phrase, case-insensitively", () => {
    expect(countKeyword("SEO tools and seo tools again", "seo tools")).toBe(2);
    // Substring matches must not count: "seotools" is not "seo tools".
    expect(countKeyword("seotools", "seo tools")).toBe(0);
  });

  it("treats regex characters in the keyword as literals", () => {
    // Unescaped, "a.b" is a regex where "." matches any character, so it would
    // also count "axb" — inflating the density of any keyword containing . + *
    // ? ( ) etc. Escaped, only the literal "a.b" counts.
    expect(countKeyword("axb and a.b", "a.b")).toBe(1);
    expect(countKeyword("node.js and nodexjs", "node.js")).toBe(1);
    expect(() => countKeyword("a (b) c", "(b)")).not.toThrow();
  });

  it("counts syllables plausibly", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("running")).toBeGreaterThanOrEqual(2);
    expect(countSyllables("")).toBe(0);
  });

  it("clamps Flesch to 0..100", () => {
    const score = fleschReadingEase("The cat sat on the mat. It was a good day.");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(fleschReadingEase("")).toBe(0);
  });

  it("falls back to blank-line paragraphs when there are no <p> tags", () => {
    // Plain-text input has no <p>; without the fallback the paragraph and
    // first-paragraph checks would silently see nothing.
    expect(getParagraphsFromHtml("first para\n\nsecond para")).toHaveLength(2);
    expect(getParagraphsFromHtml("<p>a</p><p>b</p>")).toHaveLength(2);
  });
});

describe("computeScore", () => {
  it("weights good=1, ok=0.5, poor=0", () => {
    const mk = (status: Check["status"]): Check => ({ id: "x", label: "x", status, detail: "" });
    expect(computeScore([mk("good"), mk("good")])).toBe(100);
    expect(computeScore([mk("good"), mk("poor")])).toBe(50);
    expect(computeScore([mk("ok"), mk("ok")])).toBe(50);
    expect(computeScore([])).toBe(0);
  });
});

describe("SEO checks", () => {
  it("grades content length at the 300 and 900 boundaries", () => {
    const at = (n: number) => find(analyze({ ...base, html: sentences(n / 5, 5) }).seo, "length").status;
    expect(at(1000)).toBe("good");
    expect(at(500)).toBe("ok");
    expect(at(100)).toBe("poor");
  });

  it("flags keyword stuffing above 2.5% and thin usage below 0.5%", () => {
    // 200 words, keyword 10x => 5% density
    const stuffed = `${Array(10).fill("seo tools").join(" ")} ${Array(180).fill("word").join(" ")}.`;
    expect(find(analyze({ ...base, html: stuffed, keyword: "seo tools" }).seo, "density").status).toBe("poor");

    // 400 words, keyword once => 0.25%
    const thin = `seo tools ${Array(398).fill("word").join(" ")}.`;
    expect(find(analyze({ ...base, html: thin, keyword: "seo tools" }).seo, "density").status).toBe("ok");
  });

  it("reports a missing keyword rather than silently scoring it", () => {
    const a = analyze({ ...base, html: "nothing relevant here.", keyword: "seo tools" });
    expect(find(a.seo, "density").detail).toMatch(/not found/i);
  });

  it("checks the keyword in title, slug, intro and headings", () => {
    const a = analyze({
      html: "<h2>SEO tools that work</h2><p>SEO tools are useful.</p>",
      keyword: "seo tools",
      seoTitle: "Best SEO tools for 2030",
      metaDescription: "x".repeat(140),
      slug: "best-seo-tools",
    });
    expect(find(a.seo, "kw-title").status).toBe("good");
    expect(find(a.seo, "kw-slug").status).toBe("good");
    expect(find(a.seo, "kw-heading").status).toBe("good");
    expect(find(a.seo, "first-para").status).toBe("good");
    expect(find(a.seo, "meta-len").status).toBe("good");
  });

  it("grades meta description length against the 120-160 window", () => {
    const at = (len: number) =>
      find(analyze({ ...base, html: "x.", metaDescription: "x".repeat(len) }).seo, "meta-len").status;
    expect(at(0)).toBe("poor");
    expect(at(90)).toBe("ok");
    expect(at(140)).toBe("good");
    expect(at(200)).toBe("poor");
  });
});

describe("readability checks", () => {
  it("grades average sentence length at 20 and 25 words", () => {
    const at = (wordsEach: number) =>
      find(analyze({ ...base, html: sentences(6, wordsEach) }).readability, "sent-len").status;
    expect(at(10)).toBe("good");
    expect(at(23)).toBe("ok");
    expect(at(40)).toBe("poor");
  });

  it("detects passive voice consistently across sentences", () => {
    // The original shared one /g regex, whose lastIndex makes .test() alternate
    // true/false on identical inputs — half the passive sentences go unseen.
    const passive = Array(6).fill("The report was written by the team.").join(" ");
    const pct = find(analyze({ ...base, html: passive }).readability, "passive").detail;
    expect(pct).toMatch(/100% of sentences/);
  });

  it("scores active voice as good", () => {
    const active = Array(6).fill("The team writes the report today.").join(" ");
    expect(find(analyze({ ...base, html: active }).readability, "passive").status).toBe("good");
  });

  it("rewards transition words", () => {
    const withTrans = [
      "However the result was clear.", "Therefore we shipped it.",
      "For example this works.", "Moreover it is fast.",
    ].join(" ");
    expect(find(analyze({ ...base, html: withTrans }).readability, "transition").status).toBe("good");

    const without = Array(4).fill("The cat sat down.").join(" ");
    expect(find(analyze({ ...base, html: without }).readability, "transition").status).toBe("poor");
  });

  it("flags paragraphs over 150 words", () => {
    const long = `<p>${Array(200).fill("word").join(" ")}</p>`;
    expect(find(analyze({ ...base, html: long }).readability, "para-len").status).toBe("ok");
    const short = "<p>short one</p><p>short two</p>";
    expect(find(analyze({ ...base, html: short }).readability, "para-len").status).toBe("good");
  });

  it("declines to score readability under 50 words", () => {
    const a = analyze({ ...base, html: "Too short to score." });
    expect(a.flesch).toBeNull();
    expect(find(a.readability, "flesch").detail).toMatch(/at least 50 words/i);
  });
});

describe("analyze", () => {
  it("strips HTML before counting", () => {
    const a = analyze({ ...base, html: "<p>one <strong>two</strong> three</p>" });
    expect(a.words).toBe(3);
  });

  it("extracts headings with their level", () => {
    const a = analyze({ ...base, html: "<h1>One</h1><h3>Three</h3>" });
    expect(a.headings).toEqual([{ level: 1, text: "One" }, { level: 3, text: "Three" }]);
  });

  it("excludes stop words from the top keyword list", () => {
    const a = analyze({ ...base, html: "the the the scooter scooter scooter and and" });
    expect(a.topKeywords[0]).toEqual({ word: "scooter", count: 3 });
    expect(a.topKeywords.map((k) => k.word)).not.toContain("the");
  });

  it("produces scores in 0..100", () => {
    const a = analyze({ ...base, html: sentences(20), keyword: "word" });
    for (const s of [a.seoScore, a.readabilityScore]) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("handles empty input without throwing", () => {
    const a = analyze({ ...base, html: "" });
    expect(a.words).toBe(0);
    expect(a.seoScore).toBeGreaterThanOrEqual(0);
  });
});
