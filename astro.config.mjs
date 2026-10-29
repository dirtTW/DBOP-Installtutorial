import { defineConfig } from "astro/config";
import { readdirSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

const locales = readdirSync(new URL("./src/i18n/locales/", import.meta.url))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -".ts".length))
  .sort();

// https://astro.build/config
export default defineConfig({
  site: "https://yichifauzi.github.io/DBOP-Installtutorial",
  base: "/DBOP-Installtutorial",
  i18n: {
    locales,
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: false,
  },
});