import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://yichifauzi.github.io/DBOP-Installtutorial",
  base: "/DBOP-Installtutorial",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: true
  }
});