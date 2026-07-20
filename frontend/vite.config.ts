import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep every dependency in ONE vendor chunk. Recharts 3 pulls in
        // CommonJS deps (lodash); when Vite auto-splits them into separate
        // chunks, esbuild's shared __commonJS helper can land in a different
        // chunk and be undefined at init time -> "t is not a function" in
        // production only. Co-locating all deps avoids the cross-chunk helper.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // CKEditor is pure ESM and only used in the admin blog editor —
            // give it its own chunk (lazy-loaded) so it never weighs down the
            // public pages. Everything else stays co-located (see note above).
            // Match the PACKAGES, not any path containing the word. The old
            // substring tests were too loose: `id.includes("/d3")` in
            // particular pulled unrelated modules into the d3 chunk (tightening
            // it moved real content back to vendor).
            //
            // KNOWN ISSUE, still not fixed — but no longer a mystery.
            // index.html modulepreloads ~1.2 MB of CKEditor on every page.
            // What is now established, by inspecting the built chunks:
            //
            //  - 50 chunks carry `import {X} from "./ckeditor-*.js"`, and X is
            //    a SINGLE symbol: React's JSX runtime. Not editor code.
            //  - The ckeditor chunk's first bytes are a CommonJS-wrapped React
            //    (`Symbol.for("react.transitional.element")`), and vendor
            //    contains a second copy. Two JSX runtimes in one build;
            //    rolldown picked the one inside this chunk as canonical.
            //  - React's own modules NEVER reach this function — logged every
            //    id during a build to confirm. So no rule HERE can move it,
            //    which is why the obvious "force react into vendor" fix is a
            //    no-op (tried it: byte-identical output, same chunk hash).
            //  - optimizeDeps.exclude on @ckeditor/ckeditor5-react is also a
            //    no-op for the build; .vite/deps is a dev-mode cache (tried
            //    that too, with the cache cleared: same hash again).
            //
            // ROOT CAUSE, and the fix: @ckeditor/ckeditor5-react is a CJS
            // wrapper. When the old pattern (@ckeditor OR ckeditor5) swept it
            // into this chunk, rolldown placed the wrapper's CommonJS React
            // interop — a full copy of the JSX runtime — inside the chunk, and
            // then deduplicated by pointing every OTHER chunk's JSX-runtime
            // import here. Hence 50 chunks importing one symbol from
            // "ckeditor" and index.html preloading 1.2 MB of editor to render
            // the landing page.
            //
            // Matching ONLY the pure-ESM ckeditor5 core keeps the CJS wrapper
            // in vendor with the rest of the CJS interop (exactly the
            // co-location rule at the top of this function), so the editor
            // chunk holds no React and nothing eager imports it.
            if (/node_modules[/\\]ckeditor5[/\\]/.test(id)) return "ckeditor";
            // d3 (site-structure graph) is admin/tool-only and lazy-loaded.
            if (/node_modules[/\\]d3(-[a-z]+)?[/\\]/.test(id)) return "d3";
            // exceljs (Excel report export) is only imported on click — keep it
            // out of the eager vendor chunk.
            if (id.includes("exceljs")) return "exceljs";
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    // Honor a harness/CI-assigned port (PORT env) so preview tooling can bind
    // to a free port; fall back to 5173 for normal local dev. strictPort only
    // when PORT is set, so the assigned port is used exactly (no silent drift).
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
