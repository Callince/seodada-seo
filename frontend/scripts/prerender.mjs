/**
 * Prerender the public marketing routes to static HTML.
 *
 * Why this exists: the app is a client-rendered SPA, so `dist/index.html` ships
 * `<body><div id="root"></div></body>` and nginx serves that same empty shell
 * for every route. Googlebot executes JavaScript and copes. GPTBot, ClaudeBot
 * and PerplexityBot do not — they fetch, find an empty div, and leave. For a
 * product that sells AEO/GEO, its own site was invisible to answer engines.
 *
 * How: render each route with react-dom/server and write a real HTML file per
 * route. No headless browser and no framework migration — a probe established
 * that every public page survives renderToString, because all browser access
 * (window, matchMedia, IntersectionObserver, scroll listeners) lives in effects
 * and effects do not run during server rendering.
 *
 * That same fact is the limitation: data loaded in an effect or by react-query
 * is absent, so pages whose content comes from the API prerender as a shell.
 * Those routes are deliberately NOT listed below — emitting a stripped page for
 * them would be worse than the SPA fallback, which at least fills in on load.
 * Prerendering them needs build-time data fetching; see the note in ROUTES.
 *
 * Hydration: React reuses this markup rather than discarding it. The rendered
 * output must therefore match what the client renders on first pass, which is
 * why nothing here injects markup of its own beyond the head tags React itself
 * hoisted into the SSR output.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "../dist");

/**
 * Routes rendered to static HTML.
 *
 * Excluded on purpose:
 *  - /blog/:slug, /webstories/:slug — dynamic, and the content lives in the DB
 *  - /blog, /webstories, /privacy, /terms, /cookies — list/content pages whose
 *    body is fetched at runtime, so they would prerender near-empty
 *  - /tools/* — these sit inside RequireAuth and redirect anonymous visitors to
 *    /login, so prerendering them would bake a login redirect into static HTML.
 *    /free-tools, the public page describing them, IS prerendered.
 *  - every other authenticated route — noindex, and behind a login anyway
 */
const ROUTES = [
  "/",
  "/features",
  "/pricing",
  "/free-tools",
  "/guides/technical-seo",
  "/contact",
];

/** Head elements React hoists into the SSR output, which belong in <head>. */
const HEAD_TAG = /<(title|meta|link|script)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>)/gi;

/**
 * Split the rendered string into head tags and body markup.
 *
 * React 19 emits hoisted metadata inline in renderToString output rather than
 * in a separate stream, so it has to be lifted out here. Only leading tags are
 * taken: a <script type="application/ld+json"> is head material, but a <link>
 * or <meta> appearing later inside real page content is not.
 */
function splitHead(html) {
  const head = [];
  let rest = html;
  for (;;) {
    HEAD_TAG.lastIndex = 0;
    const m = HEAD_TAG.exec(rest);
    if (!m || m.index !== 0) break;
    head.push(m[0]);
    rest = rest.slice(m[0].length);
  }
  return { head: head.join("\n    "), body: rest };
}

/** Replace the shell's fallback <title> and inject the page's own head tags. */
function buildHtml(shell, head, body) {
  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace("</head>", `  ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

async function main() {
  // Rendering the real app means the prerendered page includes the shared
  // header and footer, which carry the internal links a crawler follows.
  const { renderRoute, close } = await import("./render-route.mjs");

  // Prefer app.html when it exists: after one run, index.html is the
  // PRERENDERED HOMEPAGE, not the shell. Re-reading it would make a second run
  // treat homepage markup as the fallback template and bake the landing page
  // into every prerendered file. A fresh `vite build` empties dist, so app.html
  // is absent exactly when index.html is genuinely pristine.
  const shellPath = existsSync(join(DIST, "app.html")) ? "app.html" : "index.html";
  const shell = readFileSync(join(DIST, shellPath), "utf8");

  if (!shell.includes('<div id="root"></div>')) {
    throw new Error(
      `${shellPath} is not a pristine shell (no empty #root) — run \`vite build\` first`,
    );
  }

  // Preserve the untouched shell for the SPA fallback BEFORE "/" overwrites
  // index.html with the prerendered landing page.
  //
  // Without this the fallback and the homepage are the same file, so every
  // route that is not prerendered — /blog, /dashboard, anything new — would be
  // served the landing page's markup AND its <link rel="canonical" href="/">.
  // Client-side React recovers on load, but a crawler sees homepage content
  // under a different URL, self-canonicalised to the homepage. That is a worse
  // problem than the empty shell this script exists to replace, and it fails
  // silently because the pages look right in a browser.
  writeFileSync(join(DIST, "app.html"), shell, "utf8");

  const report = [];

  for (const route of ROUTES) {
    let rendered;
    try {
      rendered = await renderRoute(route);
    } catch (err) {
      // A route that throws must fail the build. Silently shipping the empty
      // shell for it would look like success and is the exact bug this script
      // exists to fix.
      console.error(`\n  prerender FAILED for ${route}\n  ${err.stack || err}\n`);
      process.exitCode = 1;
      continue;
    }

    const { head, body } = splitHead(rendered);
    const outDir = route === "/" ? DIST : join(DIST, route);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), buildHtml(shell, head, body), "utf8");

    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    report.push({ route, text: text.length, head: head.length });
  }

  const width = Math.max(...report.map((r) => r.route.length));
  console.log("\nprerendered:");
  for (const r of report) {
    console.log(`  ${r.route.padEnd(width)}  ${String(r.text).padStart(6)} B text  ${r.head} B head`);
  }
  const thin = report.filter((r) => r.text < 500);
  if (thin.length) {
    // Loud, because a page that renders almost nothing has silently stopped
    // being worth prerendering — usually because its content moved behind a
    // fetch — and that is invisible from a green build otherwise.
    console.warn(`\n  WARNING: ${thin.map((r) => r.route).join(", ")} rendered under 500 B of text.`);
  }
  console.log("");

  // The Vite dev server holds the event loop open; without this the script
  // finishes its work and then hangs until the build times out.
  await close();
}

await main();
