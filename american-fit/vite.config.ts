import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered by hand in main.tsx so the native shell (WKWebView has
      // no service workers) skips it instead of logging an error.
      injectRegister: null,
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "American Fit",
        short_name: "American Fit",
        description:
          "Técnica perfecta, entrenamiento inteligente, nutrición y clases en vivo.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#07090F",
        theme_color: "#07090F",
        lang: "es",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Video and live streams are never precached: they are large and
        // come from the streaming provider's CDN.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // hls.js only loads when a stream plays; non-Latin font subsets are
        // fetched on demand through unicode-range.
        globIgnores: ["**/hls-*.js", "**/*cyrillic*", "**/*greek*", "**/*vietnamese*", "**/icon-1024.png"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "wouter"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
