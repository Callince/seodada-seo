/**
 * Real-time content analysis — ported from the seodada Flask tool
 * (`static/js/script.js`).
 *
 * Pure functions over plain text + HTML, so it runs in the browser with no API
 * and no cost. Thresholds are kept identical to the original so a page scored
 * there scores the same here.
 */

export type CheckStatus = "good" | "ok" | "poor";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any",
  "are", "as", "at", "be", "because", "been", "before", "being", "below", "between",
  "both", "but", "by", "cannot", "could", "did", "do", "does", "doing", "down",
  "during", "each", "few", "for", "from", "further", "get", "got", "had", "has",
  "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more",
  "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
  "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those", "through",
  "to", "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "will", "with", "would", "you",
  "your", "yours", "yourself", "yourselves",
]);

const TRANSITION_WORDS = [
  "additionally", "also", "moreover", "furthermore", "in addition", "besides",
  "however", "nevertheless", "nonetheless", "on the other hand", "in contrast",
  "conversely", "although", "though", "even though", "whereas", "while",
  "therefore", "consequently", "as a result", "thus", "hence", "accordingly",
  "for example", "for instance", "such as", "in particular", "specifically",
  "namely", "first", "second", "third", "finally", "meanwhile", "subsequently",
  "in conclusion", "to summarise", "to summarize", "overall", "in short",
  "because", "since", "so that", "in order to", "similarly", "likewise",
];

/** Rebuilt per call: a /g regex carries lastIndex, so a shared instance makes
 *  `.test()` alternate true/false across calls — a classic silent bug. */
const passiveRe = () =>
  /\b(?:am|is|are|was|were|been|being|be)\s+(\w+ed|built|chosen|come|done|drawn|driven|eaten|fallen|felt|found|given|gone|grown|heard|held|hidden|hit|kept|known|laid|led|left|lent|lost|made|meant|met|paid|put|read|ridden|run|said|seen|sent|set|shown|shut|spoken|spent|stood|struck|taken|taught|thought|thrown|told|understood|won|worn|written)\b/i;

export function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getSentences(text: string): string[] {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => wordCount(s) > 0);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length || 1;
}

/** Flesch Reading Ease, clamped 0–100. */
export function fleschReadingEase(text: string): number {
  const sentences = getSentences(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || !sentences.length) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Whole-phrase, case-insensitive occurrences. */
export function countKeyword(text: string, keyword: string): number {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return 0;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
}

export function getHeadingsFromHtml(html: string): { level: number; text: string }[] {
  if (typeof document === "undefined") return [];
  const div = document.createElement("div");
  div.innerHTML = html;
  return [...div.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) => ({
    level: Number(el.tagName[1]),
    text: el.textContent?.trim() ?? "",
  }));
}

export function getParagraphsFromHtml(html: string): string[] {
  if (typeof document === "undefined") {
    return html.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  const ps = [...div.querySelectorAll("p")].map((p) => p.textContent?.trim() ?? "").filter(Boolean);
  // Plain-text input has no <p>; fall back to blank-line separation so the
  // paragraph and first-paragraph checks still mean something.
  return ps.length ? ps : (div.textContent ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

function pctOfSentences(sentences: string[], match: (s: string) => boolean): number {
  if (!sentences.length) return 0;
  const n = sentences.filter(match).length;
  return Math.round((n / sentences.length) * 100);
}

export interface AnalyzeInput {
  html: string;
  keyword: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
}

export interface Analysis {
  words: number;
  sentences: number;
  paragraphs: number;
  readingTimeMin: number;
  flesch: number | null;
  density: number;
  keywordCount: number;
  headings: { level: number; text: string }[];
  seo: Check[];
  readability: Check[];
  seoScore: number;
  readabilityScore: number;
  topKeywords: { word: string; count: number }[];
}

/** good = 1, ok = 0.5, poor = 0 — the original's weighting. */
export function computeScore(checks: Check[]): number {
  if (!checks.length) return 0;
  const total = checks.reduce((s, c) => s + (c.status === "good" ? 1 : c.status === "ok" ? 0.5 : 0), 0);
  return Math.round((total / checks.length) * 100);
}

export function analyze({ html, keyword, seoTitle, metaDescription, slug }: AnalyzeInput): Analysis {
  const text = stripHtml(html);
  const words = wordCount(text);
  const sentences = getSentences(text);
  const paragraphs = getParagraphsFromHtml(html);
  const headings = getHeadingsFromHtml(html);
  const kw = keyword.trim().toLowerCase();
  const freq = kw ? countKeyword(text, kw) : 0;
  const density = words > 0 && kw ? (freq / words) * 100 : 0;

  const seo: Check[] = [];

  // 1. Content length
  if (words >= 900) {
    seo.push({ id: "length", label: "Content length", status: "good", detail: `${words} words — a good length.` });
  } else if (words >= 300) {
    seo.push({ id: "length", label: "Content length", status: "ok", detail: `${words} words — aim for 900+ for in-depth content.` });
  } else {
    seo.push({ id: "length", label: "Content length", status: "poor", detail: `${words} words — too short. Write at least 300.` });
  }

  // 2. Keyword density (ideal 0.5–2.5%)
  if (kw) {
    const d = density.toFixed(2);
    if (density >= 0.5 && density <= 2.5) {
      seo.push({ id: "density", label: "Keyword density", status: "good", detail: `${d}% — appears ${freq} time(s). Ideal range.` });
    } else if (density > 2.5) {
      seo.push({ id: "density", label: "Keyword density", status: "poor", detail: `${d}% — keyword stuffing (${freq} times). Reduce it.` });
    } else if (density > 0) {
      seo.push({ id: "density", label: "Keyword density", status: "ok", detail: `${d}% — appears ${freq} time(s). Try to reach 0.5%.` });
    } else {
      seo.push({ id: "density", label: "Keyword density", status: "poor", detail: "Keyword not found in the content." });
    }
  } else {
    seo.push({ id: "density", label: "Keyword density", status: "poor", detail: "No focus keyword set." });
  }

  if (kw) {
    // 3. Keyword in the first paragraph
    const first = paragraphs[0]?.toLowerCase() ?? "";
    seo.push(countKeyword(first, kw) > 0
      ? { id: "first-para", label: "Keyword in introduction", status: "good", detail: "Keyword appears in the first paragraph." }
      : { id: "first-para", label: "Keyword in introduction", status: "poor", detail: "Keyword missing from the first paragraph. Add it early." });

    // 4. Keyword in headings
    if (!headings.length) {
      seo.push({ id: "kw-heading", label: "Keyword in headings", status: "poor", detail: "No headings found. Add headings with your keyword." });
    } else if (headings.some((h) => countKeyword(h.text, kw) > 0)) {
      seo.push({ id: "kw-heading", label: "Keyword in headings", status: "good", detail: "Keyword found in at least one heading." });
    } else {
      seo.push({ id: "kw-heading", label: "Keyword in headings", status: "ok", detail: `${headings.length} heading(s), none contain the keyword.` });
    }

    // 5. Keyword in the SEO title
    seo.push(countKeyword(seoTitle, kw) > 0
      ? { id: "kw-title", label: "Keyword in SEO title", status: "good", detail: "Keyword appears in the title." }
      : { id: "kw-title", label: "Keyword in SEO title", status: "poor", detail: "Add the keyword to the SEO title." });

    // 6. Keyword in the slug
    const slugKw = kw.replace(/\s+/g, "-");
    seo.push(slug.toLowerCase().includes(slugKw)
      ? { id: "kw-slug", label: "Keyword in URL slug", status: "good", detail: "Keyword appears in the slug." }
      : { id: "kw-slug", label: "Keyword in URL slug", status: "ok", detail: "Consider putting the keyword in the slug." });
  }

  // 7. Meta description length (Google shows ~120–160 chars)
  const descLen = metaDescription.trim().length;
  if (!descLen) {
    seo.push({ id: "meta-len", label: "Meta description", status: "poor", detail: "No meta description set." });
  } else if (descLen >= 120 && descLen <= 160) {
    seo.push({ id: "meta-len", label: "Meta description length", status: "good", detail: `${descLen} characters — ideal.` });
  } else if (descLen < 120) {
    seo.push({ id: "meta-len", label: "Meta description length", status: "ok", detail: `${descLen} characters — short. Aim for 120–160.` });
  } else {
    seo.push({ id: "meta-len", label: "Meta description length", status: "poor", detail: `${descLen} characters — Google will truncate it.` });
  }

  // 8. SEO title length
  const titleLen = seoTitle.trim().length;
  if (!titleLen) {
    seo.push({ id: "title-len", label: "SEO title", status: "poor", detail: "No SEO title set." });
  } else if (titleLen >= 30 && titleLen <= 60) {
    seo.push({ id: "title-len", label: "SEO title length", status: "good", detail: `${titleLen} characters — fits the SERP.` });
  } else {
    seo.push({ id: "title-len", label: "SEO title length", status: titleLen > 60 ? "poor" : "ok",
      detail: `${titleLen} characters — aim for 30–60.` });
  }

  // ── Readability ────────────────────────────────────────────────────
  const readability: Check[] = [];
  const flesch = words >= 50 ? fleschReadingEase(text) : null;

  if (flesch === null) {
    readability.push({ id: "flesch", label: "Content readability", status: "ok", detail: "Need at least 50 words to score readability." });
  } else if (flesch >= 60) {
    readability.push({ id: "flesch", label: "Content readability", status: "good", detail: `${flesch} — easy to read.` });
  } else if (flesch >= 30) {
    readability.push({ id: "flesch", label: "Content readability", status: "ok", detail: `${flesch} — fairly difficult. Simplify sentences.` });
  } else {
    readability.push({ id: "flesch", label: "Content readability", status: "poor", detail: `${flesch} — very difficult to read.` });
  }

  if (sentences.length) {
    const avg = Math.round(words / sentences.length);
    readability.push({
      id: "sent-len", label: "Average sentence length",
      status: avg <= 20 ? "good" : avg <= 25 ? "ok" : "poor",
      detail: `${avg} words per sentence${avg <= 20 ? " — good." : avg <= 25 ? " — try to keep under 20." : " — too long. Break them up."}`,
    });

    const longPct = pctOfSentences(sentences, (s) => wordCount(s) > 25);
    readability.push({
      id: "long-sent", label: "Long sentences",
      status: longPct <= 10 ? "good" : longPct <= 25 ? "ok" : "poor",
      detail: `${longPct}% of sentences exceed 25 words.`,
    });

    const re = passiveRe();
    const passivePct = pctOfSentences(sentences, (s) => re.test(s));
    readability.push({
      id: "passive", label: "Passive voice",
      status: passivePct <= 10 ? "good" : passivePct <= 20 ? "ok" : "poor",
      detail: `${passivePct}% of sentences use passive voice.`,
    });

    const transPct = pctOfSentences(sentences, (s) => {
      const low = s.toLowerCase();
      return TRANSITION_WORDS.some((t) => low.includes(t));
    });
    readability.push({
      id: "transition", label: "Transition words",
      status: transPct >= 30 ? "good" : transPct >= 15 ? "ok" : "poor",
      detail: `${transPct}% of sentences contain transition words${transPct >= 30 ? " — excellent flow." : ". Aim for 30%+."}`,
    });
  }

  if (paragraphs.length) {
    const longParas = paragraphs.filter((p) => wordCount(p) > 150).length;
    readability.push(longParas === 0
      ? { id: "para-len", label: "Paragraph length", status: "good", detail: "All paragraphs are a reasonable length." }
      : { id: "para-len", label: "Paragraph length", status: "ok", detail: `${longParas} paragraph(s) exceed 150 words. Consider splitting.` });
  }

  // Top keywords, stop words removed — the "is my content about what I think"
  // sanity check.
  const freqMap = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-z0-9'-]/g, "");
    if (w.length > 2 && !STOP_WORDS.has(w)) freqMap.set(w, (freqMap.get(w) ?? 0) + 1);
  }
  const topKeywords = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    words,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    readingTimeMin: Math.max(1, Math.round(words / 200)),
    flesch,
    density: Number(density.toFixed(2)),
    keywordCount: freq,
    headings,
    seo,
    readability,
    seoScore: computeScore(seo),
    readabilityScore: computeScore(readability),
    topKeywords,
  };
}
