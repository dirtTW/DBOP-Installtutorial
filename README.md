My remake site using Astro.

## Languages and appearance

English is the default language at `/`; other languages use `/<locale>/` routes.
Language dictionaries live in `src/i18n/locales/`. To add a language, add a
locale file there using the same message keys as `en.ts`; Astro discovers the
file and generates localized versions of the site pages automatically.

The theme control in the navigation switches between light and dark mode and
remembers the choice in the browser.

## Website directory

The Minecraft resources and useful websites lists are merged into a single
directory at `/useful-website` (and `/zh-TW/useful-website`). Entries live in
`lists/useful-websites.md` and carry category tags that power the filter chips;
see `lists/README.md` for the format. The old Minecraft page redirects there.

## Tests

- `npm test` runs the Vitest unit tests.
- `npm run build` then `npm run test:e2e` runs the Playwright end-to-end tests.

Playwright uses the installed Google Chrome by default. To use Playwright's
bundled browser instead, run `npx playwright install chromium` and set
`PLAYWRIGHT_CHANNEL=chromium`.

## Minecraft 伺服器啟動參數產生器

The site includes a configurable Minecraft server launch-script generator at
`/DBOP-Installtutorial/flags-generator`. Its functionality was independently
implemented, with inspiration from [flags.sh](https://flags.sh/) by
[YouHaveTrouble](https://github.com/YouHaveTrouble/flags.sh). No flags.sh
source code is used.
