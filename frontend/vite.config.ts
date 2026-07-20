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
            // KNOWN ISSUE, not fixed by this: the entry chunk still ends up with
            // a static `import {X} from "./ckeditor-*.js"`, so index.html
            // modulepreloads ~1.2 MB of CKEditor on every page, landing page
            // included. It is NOT a source-level import — RichEditor is only
            // ever `lazy()`-imported, and the chunk contains no app code — so it
            // is a rolldown chunk-graph artefact. Diagnosing it further means
            // touching the chunk split that previously caused a production-only
            // "t is not a function" crash (see the note above), so it needs a
            // deliberate session with a production smoke test, not a drive-by.
            if (/node_modules[/\\](@ckeditor[/\\]|ckeditor5)/.test(id)) return "ckeditor";
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
