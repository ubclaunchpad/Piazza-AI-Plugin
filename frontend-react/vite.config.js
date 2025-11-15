import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      // Declare content and background as explicit entries so Vite/Rollup
      // emits standalone files for extension runtime (content script & service worker).
      input: {
        "src/popup/index": path.resolve(__dirname, "src/popup/index.html"),
        "src/content/content": path.resolve(
          __dirname,
          "src/content/content.js"
        ),
        "src/background/background": path.resolve(
          __dirname,
          "src/background/background.js"
        ),
      },
      output: {
        // Use the input keys as output paths so files appear under dist/src/...
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
