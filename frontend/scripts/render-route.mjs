/**
 * Renders one route to an HTML string, under Node.
 *
 * Uses Vite's own SSR module loader rather than a second build: `ssrLoadModule`
 * transforms TS/JSX and resolves the "@/" alias exactly as the app build does,
 * so there is no parallel toolchain to keep in step. It is slower per module
 * than a bundle, but the server is created once and only a handful of routes
 * are rendered.
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
    // Only project sources go through ssrLoadModule — it transforms TSX and
    // resolves the "@/" alias. Bare packages are imported natively: passing
    // them to ssrLoadModule tries to inline their CJS builds and dies on
    // "module is not defined". Vite externalizes node_modules for SSR anyway,
    // so router.tsx ends up bound to these exact same instances — which is
    // what keeps React singular and hooks working.
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
  const { router } = await boot();

  // Resolve every React.lazy() before rendering.
  //
  // On a cold pass the lazy boundary suspends and React switches to
  // out-of-order streaming: the shell ships with the fallback in place and the
  // real content is appended afterwards inside `<div hidden id="S:0">` for a
  // client script to move. That hydrates correctly, but it buries the page's
  // entire content in a hidden element — the markup search engines discount —
  // which would defeat the point of prerendering. Measured before this: all
  // 1.1 kB of /pricing's plan copy sat inside that hidden div.
  //
  // Awaiting the loader functions is not enough; resolving the promise never
  // flips React's payload state, so the boundary still suspends. Neither does a
  // throwaway first render (tried it — the second pass suspended too). What
  // works is completing the payload exactly as React's own lazy initializer
  // does. That reaches into `_status`/`_result`, so the hidden-div assertion
  // below is deliberately kept as the tripwire: if React ever changes this
  // shape the build fails loudly instead of silently shipping hidden content.
  await warmLazy(router.routes);
  const html = await renderOnce(route, await resolveTree(router.routes));

  // KNOWN LIMITATION, not fixed. Something in the tree still suspends, so React
  // takes the out-of-order streaming path: the shell ships first and the page's
  // own content is appended inside `<div hidden id="S:0">`, which a client
  // script moves into place on load.
  //
  // What this does and does not cost:
  //   - the content IS in the HTML source, which is the whole point — LLM
  //     fetchers that never run JS can read it, where before they got an empty
  //     <div id="root">.
  //   - it is marked hidden, and Google may weight hidden text lower. So this
  //     is a large win for AEO/GEO and a partial one for classic ranking.
  //
  // Ruled out, so nobody repeats them: awaiting the lazy loaders (never flips
  // React's payload state); a throwaway first render; completing the payloads
  // by hand as React's initializer does; and substituting the resolved
  // components into a lazy-free route tree. All four still suspended, so the
  // source is NOT React.lazy — most likely react-router's RouterProvider
  // resolving the match. Next step is to bisect by rendering a page component
  // directly, without the router, and reintroducing layers one at a time.
  if (html.includes("<div hidden")) {
    hiddenContentRoutes.push(route);
  }
  return html;
}

/** Routes whose content landed in React's hidden streaming div; reported at the
 *  end of the run so the limitation is visible on every build rather than
 *  discovered later by someone reading the HTML. */
export const hiddenContentRoutes = [];

/**
 * Drive every React.lazy payload to its fulfilled state.
 *
 * Mirrors React's lazyInitializer: an uninitialized payload holds the loader in
 * `_result` with `_status === -1`; once resolved it holds the module in
 * `_result` with `_status === 1`. Walks route elements AND their children,
 * because the public shell is itself a lazy component nested inside a
 * <Suspense> element's props.
 */
async function warmLazy(routes) {
  const payloads = [];
  const seen = new Set();

  const fromElement = (el) => {
    if (!el || typeof el !== "object" || seen.has(el)) return;
    seen.add(el);
    if (Array.isArray(el)) return el.forEach(fromElement);
    const payload = el.type?._payload;
    if (payload && typeof payload._result === "function" && payload._status === -1) {
      payloads.push(payload);
    }
    if (el.props?.children) fromElement(el.props.children);
  };

  const walk = (rs) => {
    for (const r of rs ?? []) {
      fromElement(r.element);
      walk(r.children);
    }
  };
  walk(routes);

  await Promise.all(
    payloads.map(async (p) => {
      const mod = await p._result();
      p._status = 1;
      p._result = mod;
    }),
  );

  // Newly resolved modules can expose further lazy elements, so repeat until
  // a pass finds nothing new.
  if (payloads.length) await warmLazy(routes);
}

/**
 * Rebuild the route tree with every resolved lazy swapped for the real
 * component, so the render has nothing left to suspend on.
 *
 * Warming the payloads alone was not enough — React still took the streaming
 * path and produced hidden-div output. Substituting the components removes the
 * lazy indirection altogether, which is what actually keeps the markup in
 * document order. Only the prerender sees this tree; the browser keeps the
 * lazy routes and their code splitting untouched.
 */
async function resolveTree(routes) {
  const { react } = await boot();
  const { createElement: h, Fragment } = react;

  const swap = (el) => {
    if (!el || typeof el !== "object") return el;
    if (Array.isArray(el)) return el.map(swap);
    const payload = el.type?._payload;
    if (payload?._status === 1) {
      const mod = payload._result;
      const Comp = mod?.default ?? mod;
      return h(Comp, el.props);
    }
    if (el.props?.children) {
      return h(el.type ?? Fragment, el.props, swap(el.props.children));
    }
    return el;
  };

  return routes.map(function map(r) {
    return {
      ...r,
      ...(r.element ? { element: swap(r.element) } : {}),
      ...(r.children ? { children: r.children.map(map) } : {}),
    };
  });
}

async function renderOnce(route, routeTree) {
  const { prerenderToNodeStream, router, reactRouter, reactQuery, react } = await boot();
  const { createElement: h } = react;
  const tree = routeTree ?? router.routes;

  // prerenderToNodeStream, not renderToString. Every public page is behind a
  // React.lazy() and renderToString cannot suspend-and-wait — it emits the
  // Suspense fallback, which for these routes is an empty div. The first
  // attempt here produced six pages of 0 bytes that the script cheerfully
  // reported as prerendered. Pre-calling the lazy loaders does not help either:
  // resolving the promise yourself never flips React's internal payload state,
  // only React's own initializer does. This API is the one designed for static
  // generation and resolves the boundaries before completing.
  const memoryRouter = reactRouter.createMemoryRouter(tree, {
    initialEntries: [route],
  });
  const queryClient = new reactQuery.QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  // Collected, NOT thrown from onError: throwing inside the callback aborts the
  // stream, and React then emits a "Switched to client rendering" bailout
  // marker into the output — which still looks like a page and still has a
  // plausible byte count, so it reads as success. Gather them and decide after.
  const errors = [];
  const { prelude } = await prerenderToNodeStream(
    h(
      reactQuery.QueryClientProvider,
      { client: queryClient },
      h(reactRouter.RouterProvider, { router: memoryRouter }),
    ),
    { onError: (err) => errors.push(err) },
  );

  const chunks = [];
  for await (const chunk of prelude) chunks.push(chunk);
  const html = Buffer.concat(chunks).toString("utf8");

  if (errors.length) {
    throw new Error(
      `${errors.length} render error(s):\n` + errors.map((e) => `  - ${e.stack || e}`).join("\n"),
    );
  }
  // Belt and braces: if React bailed out to client rendering, the markup is not
  // a prerender no matter how large it is.
  if (html.includes("Switched to client rendering")) {
    throw new Error("React bailed out to client rendering; output is not a usable prerender");
  }
  return html;
}

export async function close() {
  await vite?.close();
}
