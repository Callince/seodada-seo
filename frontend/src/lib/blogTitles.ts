/**
 * Blog title generation — ported from the seodada Flask tool
 * (`blueprints/seo_tools.py::_generate_titles_template`).
 *
 * Template-based, not AI: the original called no model either, so this runs
 * entirely in the browser with no API, no key and no cost. That is what makes
 * it viable as a public no-login tool.
 *
 * The year is derived rather than hardcoded — the Flask templates baked in
 * "2026", which silently dates every generated title once the year turns.
 */

export type TitleStyle = "mixed" | "how_to" | "listicle" | "question" | "emotional" | "seo";
export type TitleTone = "formal" | "casual" | "professional" | "friendly" | "witty" | "inspirational" | "urgent";

export const STYLES: { id: TitleStyle; label: string; hint: string }[] = [
  { id: "mixed", label: "Mixed", hint: "A spread of every style below" },
  { id: "how_to", label: "How-to", hint: "Guides and tutorials" },
  { id: "listicle", label: "Listicle", hint: "Numbered lists" },
  { id: "question", label: "Question", hint: "Titles that ask" },
  { id: "emotional", label: "Emotional", hint: "Power words" },
  { id: "seo", label: "SEO", hint: "Keyword-first, search-led" },
];

export const TONES: { id: TitleTone; label: string }[] = [
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "witty", label: "Witty" },
  { id: "inspirational", label: "Inspirational" },
  { id: "urgent", label: "Urgent" },
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "for", "to", "in", "on", "at", "by",
  "with", "from", "as", "is", "are", "was", "were", "be", "been", "it", "its",
  "this", "that", "these", "those", "how", "what", "why", "when", "your", "you",
]);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Reduce free-form input to the phrase the templates slot in.
 *
 * A short single line is used as-is. Anything longer (a paragraph, or a list of
 * subtopics) is reduced to its most repeated bigram, falling back to the most
 * repeated word — mirroring `_extract_blog_theme` in the Flask original, which
 * existed because users paste outlines, not keywords.
 */
export function extractTheme(input: string): string {
  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return input.trim().slice(0, 60);
  if (lines.length === 1 && lines[0].length <= 60) return lines[0];

  const words: string[] = [];
  for (const line of lines) {
    for (const raw of line.toLowerCase().split(/\s+/)) {
      const w = raw.replace(/^[.,;:!?()"'-]+|[.,;:!?()"'-]+$/g, "");
      if (w && !STOP_WORDS.has(w) && w.length > 2) words.push(w);
    }
  }
  if (!words.length) return lines[0].slice(0, 60);

  const bigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const b = `${words[i]} ${words[i + 1]}`;
    bigrams.set(b, (bigrams.get(b) ?? 0) + 1);
  }
  const unigrams = new Map<string, number>();
  for (const w of words) unigrams.set(w, (unigrams.get(w) ?? 0) + 1);

  const best = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const topBigram = best(bigrams);
  if (topBigram && topBigram[1] > 1) return titleCase(topBigram[0]);
  const topWord = best(unigrams);
  return topWord ? titleCase(topWord[0]) : lines[0].slice(0, 60);
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function pools(k: string, year: number): Record<TitleStyle, string[]> {
  const n = (opts: string[]) => pick(opts);

  const how_to = [
    `How to ${k}: A Complete Step-by-Step Guide for Beginners and Professionals`,
    `How to ${k} in ${year}: Proven Strategies That Actually Deliver Results`,
    `A Step-by-Step Guide to ${k} That Saves You Time and Effort`,
    `How to ${k} Like a Pro: Insider Tips Most People Overlook`,
    `The Beginner's Roadmap to ${k}: Everything You Need to Get Started`,
    `How to Master ${k}: Expert-Backed Tips for Faster Results`,
    `How to ${k} Without Making the Common Mistakes That Hold You Back`,
    `From Zero to Expert: How to ${k} and See Real Results Fast`,
    `How to ${k}: Everything You Need to Know Before Getting Started`,
    `How to Successfully ${k} with Real-World Examples and Case Studies`,
    `How to ${k}: Proven Strategies and Frameworks That Work in ${year}`,
    `A Practical and Actionable Guide to ${k} for Working Professionals`,
  ];

  const listicle = [
    `${n(["7", "10", "12"])} Creative Ways to ${k} That Most People Haven't Tried Yet`,
    `${n(["5", "7", "10"])} Essential Tips for ${k} Every Professional Should Know`,
    `Top ${n(["7", "10"])} ${k} Strategies That Are Driving Real Results in ${year}`,
    `${n(["8", "10"])} Best Practices for ${k} That Successful Brands Follow`,
    `${n(["5", "7", "9"])} Common ${k} Mistakes to Avoid If You Want Real Growth`,
    `${n(["5", "7"])} Proven Methods to Improve ${k} and Stay Ahead of the Competition`,
    `${n(["10", "15"])} Inspiring ${k} Examples That Will Change How You Think`,
    `Top ${n(["5", "10"])} Must-Have Tools for ${k} That Professionals Rely On`,
    `${n(["5", "7"])} Reasons Why ${k} Matters More Than Ever in Today's World`,
    `${n(["8", "10"])} Essential ${k} Tips for Beginners Who Want to Start Strong`,
    `${n(["10", "12"])} Surprising Things You Didn't Know About ${k}`,
    `${n(["5", "7"])} Well-Kept ${k} Secrets That Industry Experts Swear By`,
  ];

  const question = [
    `What Is ${k} and Why Should Every Business Take It Seriously?`,
    `Why Should You Care About ${k} in a Rapidly Changing Digital World?`,
    `What Are the Best Strategies for ${k} and How Do You Apply Them?`,
    `Is ${k} Worth the Investment? Here's What the Data Actually Shows`,
    `How Can ${k} Transform the Way You Do Business in ${year}?`,
    `What Makes ${k} So Important and Why Are Experts Paying Attention?`,
    `Are You Making These ${k} Mistakes That Could Be Costing You Growth?`,
    `What Every Professional Should Know About ${k} Before It's Too Late`,
    `Why Is ${k} Shaping the Future of the Industry Right Now?`,
    `How Does ${k} Impact Your Long-Term Success and Growth Strategy?`,
    `What Are the Top Emerging Trends in ${k} You Can't Afford to Ignore?`,
    `Can ${k} Really Make a Measurable Difference for Your Business?`,
  ];

  const emotional = [
    `The Ultimate Guide to ${k}: Everything You Need to Succeed`,
    `The Essential ${k} Playbook You Simply Cannot Afford to Ignore`,
    `Proven ${k} Techniques That Deliver Remarkable and Lasting Results`,
    `The Hidden Power of ${k}: What Nobody Is Talking About Yet`,
    `Incredible ${k} Strategies That Actually Work in the Real World`,
    `The Definitive ${k} Strategy for Explosive and Sustainable Growth`,
    `Powerful ${k} Methods That Will Completely Change How You Work`,
    `The Truth About ${k}: What Industry Experts Won't Tell You`,
    `Unlock the Full Power of ${k}: A Must-Read Guide for ${year}`,
    `Stop Struggling with ${k}: The Complete Solution Is Finally Here`,
    `The Game-Changing Guide to ${k} That Professionals Swear By`,
    `Why ${k} Is the Biggest Untapped Opportunity Right Now`,
  ];

  const seo = [
    `${k}: The Complete Guide with Actionable Tips and Best Practices`,
    `${k} Demystified: Smart Strategies for Better and Faster Results`,
    `Rethinking ${k}: How to Succeed in a Competitive Landscape in ${year}`,
    `${k}: What It Is, How It Works, and Why It Matters for Your Growth`,
    `Best ${k} Strategies for Sustainable Growth and Long-Term Success`,
    `${k} for Beginners: A Comprehensive and Easy-to-Follow Guide`,
    `${k} Explained: Key Benefits, Practical Tips, and Real Examples`,
    `From Basics to Mastery: ${k} Best Practices and Expert Strategies`,
    `${k} Tutorial: A Clear Step-by-Step Walkthrough with Examples`,
    `Learn ${k} the Right Way: A Free In-Depth Guide with Examples`,
    `${k}: Essential Tools, Tips, and Techniques That Actually Work`,
    `Beyond the Basics: A Fresh and Practical Approach to ${k}`,
  ];

  return {
    how_to, listicle, question, emotional, seo,
    mixed: [...how_to, ...listicle, ...question, ...emotional, ...seo],
  };
}

/** Tone is applied as a light rewrite; the Flask version accepted a tone but
 *  only ever passed it to a prompt it did not use, so titles came back
 *  identical whatever you picked. Doing something visible is better than a
 *  control that silently does nothing. */
function applyTone(title: string, tone: TitleTone): string {
  switch (tone) {
    case "casual":
      return title.replace(/^The Ultimate Guide to /, "Your Go-To Guide for ")
                  .replace(/Professionals/g, "People");
    case "friendly":
      return title.replace(/^How to /, "Here's How to ");
    case "urgent":
      return /\b(Now|Today|Before)\b/.test(title) ? title : `${title} — Start Today`;
    case "witty":
      return title.replace(/^The Truth About /, "The Not-So-Secret Truth About ");
    case "inspirational":
      return title.replace(/^Why /, "Why Now Is the Moment ");
    case "professional":
    case "formal":
    default:
      return title;
  }
}

export interface GenerateOptions {
  topic: string;
  focusKeyword?: string;
  style: TitleStyle;
  tone: TitleTone;
  count: number;
  /** Injectable so tests are deterministic. */
  year?: number;
}

export function generateTitles({
  topic, focusKeyword, style, tone, count, year,
}: GenerateOptions): string[] {
  const source = (focusKeyword || "").trim() || topic;
  const theme = extractTheme(source);
  if (!theme) return [];

  const pool = [...pools(theme, year ?? new Date().getFullYear())[style]];
  // Fisher-Yates on a copy — the Flask version shuffled the shared pool in
  // place, which is fine there but would be a mutation bug here.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = Math.min(Math.max(count, 1), 10);
  return pool.slice(0, n).map((t) => applyTone(t, tone));
}
