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
      // A custom service worker (client/src/sw.ts) instead of the fully
      // generated one, so it can also handle real push notifications —
      // see SETUP.md section 6.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: ["icons/icon-32.png", "icons/icon-180.png"],
      manifest: {
        name: "Easycomex",
        short_name: "Easycomex",
        description: "Lleva tu marca a vender en Estados Unidos: Amazon, TikTok Shop y Shopify.",
        start_url: "/",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#1B1A45",
        lang: "es",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      injectManifest: {
        // The 3D globe chunk is huge and lazy-loaded on purpose — don't
        // make the service worker download it upfront on every install.
        globIgnores: ["**/GlobalReachSection-*.js"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
