import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Focusly renderer build config.
// base: "./" is required so Electron can load the built files via file:// in production.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
