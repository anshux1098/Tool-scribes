import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    cssMinify: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id, { getModuleInfo }) {
          // React core — always split out so it can be tree-shaken and cached
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react";
          }
          // All @radix-ui packages into a single chunk
          if (id.includes("node_modules/@radix-ui/")) {
            return "radix";
          }
          // React router
          if (id.includes("node_modules/react-router-dom") || id.includes("node_modules/react-router")) {
            return "router";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "tanstack-query";
          }
          // Framer Motion — heavy animation lib
          if (id.includes("node_modules/framer-motion")) {
            return "framer-motion";
          }
          // Recharts — large charting library
          if (id.includes("node_modules/recharts")) {
            return "recharts";
          }
          // Supabase
          if (id.includes("node_modules/@supabase/")) {
            return "supabase";
          }
          // Heavy utility libs
          if (id.includes("node_modules/lodash") ||
              id.includes("node_modules/date-fns") ||
              id.includes("node_modules/zod")) {
            return "utils";
          }
          // Other vendor libs grouped
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
        // Keep component chunks small and cacheable
        chunkFileNames: (chunkInfo) => {
          const prefix = chunkInfo.name === "vendor" || chunkInfo.name === "react" || chunkInfo.name === "radix"
            ? "[name]-[hash].js"
            : "[name]-[hash].js";
          return `js/${prefix}`;
        },
        entryFileNames: "js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ?? "";
          if (/\.(css|scss|sass)$/.test(info)) {
            return "css/[name]-[hash][extname]";
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(info)) {
            return "img/[name]-[hash][extname]";
          }
          if (/\.woff2?$/.test(info)) {
            return "fonts/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
