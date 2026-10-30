# DBOP Install Tutorial

A bilingual (English / 繁體中文) Astro site for **DBOP — DirtTW's Basement Optimize Pack**, a
Minecraft optimization modpack. It hosts the step-by-step installation guide, modpack
recommendations, a directory of useful websites, and a Minecraft server launch-flag generator.

**Live site:** https://dirttw.github.io/DBOP-Installtutorial/

## Pages

| Route | What it is |
| --- | --- |
| `/` | Landing page with links to every section |
| `/dbop-install-tutorial` | Step-by-step DBOP install and modpack setup guide |
| `/recommended-modpacks` | Modpack recommendations, with Modrinth metadata and optional CurseForge art |
| `/useful-website` | Searchable, category-filtered directory of Minecraft and general software links |
| `/flags-generator` | Minecraft server launch-script generator (Paper, Purpur, Velocity, …) |
| `/zh-TW/...` | Traditional Chinese version of every page above |

The legacy `/minecraft-useful-website` page redirects to `/useful-website` and is excluded
from the sitemap.

## Tech stack

- **Astro 7** with file-based routing and static output
- **Tailwind CSS 4** through the Vite plugin
- **@material/web 2** (Google's Material 3 web components) for interactive controls
- **Material Symbols Outlined** + Roboto from Google Fonts
- **TypeScript** (checked during `npm run build` via `astro check`)
- **Vitest** for unit tests, **Playwright** for end-to-end tests
- Deployed to **GitHub Pages** by GitHub Actions

## Getting started

Requires **Node.js 24** or newer (`engines` in `package.json`).

```bash
npm install
npm run dev        # http://localhost:4321/DBOP-Installtutorial/
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm start` | Start the dev server with HMR |
| `npm run build` | Type-check with `astro check`, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` / `npm run test:unit` | Run the Vitest unit tests |
| `npm run test:e2e` | Run the Playwright end-to-end tests |

The site is served from the `/DBOP-Installtutorial` base path, so use the full URL above
rather than `http://localhost:4321/`.

## Project structure

```
lists/                     Content: website directory + modpack entries (Markdown)
src/components/            Navbar, footer, cards, and the flags generator
src/i18n/                  Translation loader and the per-locale dictionaries
src/layouts/               Page shells (landing page, guides, directory, modpacks)
src/lib/website-links.ts   Parses the website lists and category tags
src/pages/                 Routes, including the [locale] catch-all
src/styles/global.css      Tailwind entry point and shared component styles
tests/unit/                Vitest tests
tests/e2e/                 Playwright tests
```

## Editing content

### Website directory

Entries live in `lists/useful-websites.md`, one link per line with at least one category
tag. The tags drive the filter chips on `/useful-website`.

```markdown
- [Prism Launcher](https://prismlauncher.org/) #minecraft #launchers
```

Available tags: `minecraft`, `launchers`, `mods`, `servers`, `world`, `software`, `media`,
`security`. See [`lists/README.md`](lists/README.md) for the full format.

`lists/recommended-modpacks.md` uses its own `link:` format because the modpack page can
fetch Modrinth metadata and supports optional CurseForge image URLs.

### Languages

English is the default at `/`; other languages use `/<locale>/` routes. Dictionaries live in
`src/i18n/locales/` and are discovered automatically at build time — to add a language, copy
`en.ts` to a new `<locale>.ts` and translate the message keys. No route files need to change.

Translated site names for directory entries go in the `siteLabels` map of each locale;
entries without a translation fall back to the label in the Markdown file.

### Theme

The navbar toggle switches between light and dark mode, persists the choice in
`localStorage`, and falls back to the operating system preference.

The whole site uses a Material 3 (Material You) design system. Color roles are defined once in
`src/styles/global.css` under `:root` / `html.dark` as `--md-sys-color-*` tokens, which style the
`@material/web` components directly. Buttons, icon buttons, text fields, chips, switches, sliders,
tabs, and the dialog are official `md-*` custom elements; only the layout surfaces with no
upstream component (cards, panels, the search-bar skin) keep a small set of local classes.
Tailwind handles layout and typography. Icons come from Material Symbols Outlined.

## Flags generator

`/flags-generator` builds a ready-to-run launch script or raw `java` command from a few
choices:

- **Presets:** Basic, Aikar's (default), ZGC, Shenandoah, and Velocity / Proxy. Aikar's flags
  switch to the 12 GB+ tuning automatically once the heap reaches 12 GB.
- **Memory:** slider with presets, plus a dialog for fractional values.
- **Options:** GUI toggle (`--nogui`) and an **Ignore Java version** switch that adds
  `-Dpaper.ignoreJavaVersion=true`. Both are disabled where they would be invalid, such as
  the GUI toggle for Velocity proxies.
- **Output:** Linux / macOS script, Windows `.bat`, or the plain Java command, with copy and
  download buttons.

The presets mirror the arrays published by the
[Flectone flags generator](https://flectone.net/en/tools/server-flags-generator); Aikar's
values follow the [Paper documentation](https://docs.papermc.io/paper/aikars-flags). The
implementation is original and inspired by [flags.sh](https://flags.sh/) by
[YouHaveTrouble](https://github.com/YouHaveTrouble/flags.sh) — no flags.sh source code is
used.

## Special thanks

Built with [Astro](https://astro.build) (MIT), [Tailwind CSS](https://tailwindcss.com) (MIT),
[@material/web](https://github.com/material-components/material-web) and
[Material Symbols](https://fonts.google.com/icons) (Apache-2.0, Google), and TypeScript
(Apache-2.0). Data and downloads come from [Modrinth](https://modrinth.com),
[CurseForge](https://www.curseforge.com), [Adoptium](https://adoptium.net), and
[Prism Launcher](https://prismlauncher.org) (GPL-3.0).

The flags generator is inspired by [flags.sh](https://flags.sh) (MIT) and uses values from
[Flectone](https://flectone.net/en/tools/server-flags-generator) and
[Aikar's flags](https://docs.papermc.io/paper/aikars-flags) (PaperMC docs, BSD-2-Clause). Thanks
also to CaffeineMC ([Sodium](https://modrinth.com/mod/sodium)), the
[Iris Shaders](https://modrinth.com/mod/iris) team, embeddedt
([ModernFix](https://modrinth.com/mod/modernfix)), lucko ([spark](https://modrinth.com/mod/spark)),
every mod author in DBOP, and every project in the [useful websites directory](lists/useful-websites.md).

Minecraft is a trademark of Mojang Studios and Microsoft. This is an unofficial community project.

## Tests

```bash
npm test             # Vitest: list parsing, category filters, search
npm run build        # Playwright e2e serves this preview build
npm run test:e2e     # Playwright: directory filters and flags generator behaviour
```

Playwright uses the installed Google Chrome by default. To use Playwright's bundled browser
instead, run `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`.

## Deployment

Pushing to `master` triggers `.github/workflows/astro.yml`, which builds the site on Node 24
and deploys `dist/` to GitHub Pages. Builds can also be started manually from the Actions tab
or via a `rebuild` `repository_dispatch` event.

## License

No license file is included in this repository.
