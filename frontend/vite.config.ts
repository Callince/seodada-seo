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
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
