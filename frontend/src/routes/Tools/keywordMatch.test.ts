import { describe, expect, it } from "vitest";

/** Mirrors termRegex/countIn in AnalyzeTool.tsx. Kept as a copy on purpose:
 *  these two helpers were silently corrupted once (a shell heredoc halved the
 *  backslashes, turning "\\s+" into "s+" and "\\b" into a backspace character)
 *  and it still typechecked, still lint-passed, and still built. Only
 *  behaviour catches that class of damage. */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function termRegex(term: string): RegExp | null {
  const t = term.trim();
  if (!t) return null;
  const body = escapeRe(t).replace(/\s+/g, "\\s+");
  const lead = /^\w/.test(t) ? "\\b" : "";
  const tail = /\w$/.test(t) ? "\\b" : "";
  return new RegExp(`${lead}${body}${tail}`, "gi");
}
const fresh = (re: RegExp) => new RegExp(re.source, re.flags);
const countIn = (text: string, re: RegExp) => (text.match(fresh(re)) || []).length;

describe("keyword matching", () => {
  it("does not match inside a longer word", () => {
    const re = termRegex("seo")!;
    expect(countIn("seo audit", re)).toBe(1);
    expect(countIn("Seoul is a city", re)).toBe(0);
    expect(countIn("aseo", re)).toBe(0);
  });

  it("is case-insensitive and counts every occurrence", () => {
    const re = termRegex("running shoes")!;
    expect(countIn("Running Shoes are shoes. Buy running shoes now.", re)).toBe(2);
  });

  it("tolerates any whitespace between words", () => {
    // The corruption that survived typecheck: "\\s+" became "s+", so this
    // matched the literal "runnings+shoes" and nothing a page would contain.
    const re = termRegex("running shoes")!;
    expect(countIn("running  shoes", re)).toBe(1);
    expect(countIn("running\nshoes", re)).toBe(1);
    expect(countIn("runnings+shoes", re)).toBe(0);
  });

  it("escapes regex metacharacters in the term", () => {
    expect(countIn("price is $5.00 today", termRegex("$5.00")!)).toBe(1);
    // Unescaped, "." would match any character and this would be a false hit.
    expect(countIn("price is $5900 today", termRegex("$5.00")!)).toBe(0);
    expect(() => termRegex("c++")).not.toThrow();
    expect(countIn("i know c++ well", termRegex("c++")!)).toBe(1);
  });

  it("gives the same count on repeated calls (no shared lastIndex)", () => {
    // The /g cursor bug: sharing one regex meant the second call resumed from
    // where the first stopped and under-counted.
    const re = termRegex("seo")!;
    expect(countIn("seo seo seo", re)).toBe(3);
    expect(countIn("seo seo seo", re)).toBe(3);
    expect(countIn("seo seo seo", re)).toBe(3);
  });

  it("blank terms produce no regex", () => {
    expect(termRegex("")).toBeNull();
    expect(termRegex("   ")).toBeNull();
  });
});
