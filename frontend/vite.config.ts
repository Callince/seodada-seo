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
            if (id.includes("ckeditor")) return "ckeditor";
            // d3 (site-structure graph) is admin/tool-only and lazy-loaded.
            if (id.includes("/d3") || id.includes("d3-")) return "d3";
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
