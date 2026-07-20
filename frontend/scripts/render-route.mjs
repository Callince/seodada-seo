/**
 * Renders one route to an HTML string, under Node.
 *
 * Uses Vite's own SSR module loader rather than a second build: `ssrLoadModule`
 * transforms TS/JSX and resolves the "@/" alias exactly as the app build does.
 * Bare packages are imported natively — Vite externalizes node_modules for SSR,
 * so router.tsx binds to these exact same instances, which keeps React singular
 * and hooks working.
 *
 * Renders the app's REAL route tree (router.tsx) through the real data router,
 * so the prerendered page includes PublicShell's header and footer and there is
 * no second route table to drift.
 *
 * THE ONE NON-OBVIOUS OPTION — progressiveChunkSize, and why it must stay:
 *
 * Without it, every prerendered page came out with its content inside
 * `<div hidden id="S:0">` after the closing </footer>, and the Suspense
 * boundary in PublicShell showing its fallback. That is NOT suspension — a
 * long bisection falsified lazy-warming, Suspense-dissolving and a
 * router-deferral theory before the real cause surfaced: React Fizz OUTLINES a
 * Suspense boundary whose content exceeds progressiveChunkSize (~12.8 kB
 * default), emitting it out-of-order for progressive reveal even in a static
 * prerender where nothing suspends. Every public page is bigger than that.
 * Raising the threshold makes outlining impossible, and the markup arrives in
 * document order — which is the entire point of prerendering, since content
 * buried in a hidden div is what crawlers discount.
 */
import { createServer } from "vite";

let vite;
let deps;

async function boot() {
  vite ??= await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "warn",
  });
  if (!deps) {
    const [{ prerenderToNodeStream }, router, reactRouter, reactQuery, react] = await Promise.all([
      import("react-dom/static"),
      vite.ssrLoadModule("/src/router.tsx"),
      import("react-router-dom"),
      import("@tanstack/react-query"),
      import("react"),
    ]);
    deps = { prerenderToNodeStream, router, reactRouter, reactQuery, react };
  }
  return deps;
}

export async function renderRoute(route) {
  const { prerenderToNodeStream, router, reactRouter, reactQuery, react } = await boot();
  const { createElement: h } = react;

  const memoryRouter = reactRouter.createMemoryRouter(router.routes, {
    initialEntries: [route],
  });
  const queryClient = new reactQuery.QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  // Errors are collected, NOT thrown from onError: throwing inside the callback
  // aborts the stream and React emits a "Switched to client rendering" bailout
  // marker that still looks like a page. Gather, then decide.
  const errors = [];
  const { prelude } = await prerenderToNodeStream(
    h(
      reactQuery.QueryClientProvider,
      { client: queryClient },
      h(reactRouter.RouterProvider, { router: memoryRouter }),
    ),
    {
      onError: (err) => errors.push(err),
      // See the header comment. 10 MB = "never outline".
      progressiveChunkSize: 10 * 1024 * 1024,
    },
  );

  const chunks = [];
  for await (const chunk of prelude) chunks.push(chunk);
  const html = Buffer.concat(chunks).toString("utf8");

  if (errors.length) {
    throw new Error(
      `${errors.length} render error(s):\n` + errors.map((e) => `  - ${e.stack || e}`).join("\n"),
    );
  }
  // Tripwires. If either fires, do NOT ship the output — find what changed.
  if (html.includes("<div hidden")) {
    throw new Error("content was outlined into a hidden div — check progressiveChunkSize still applies");
  }
  if (html.includes("Switched to client rendering")) {
    throw new Error("React bailed out to client rendering; output is not a usable prerender");
  }
  return html;
}

export async function close() {
  await vite?.close();
}
