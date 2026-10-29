My remake site using Astro.

## Languages and appearance

English is the default language at `/`; other languages use `/<locale>/` routes.
Language dictionaries live in `src/i18n/locales/`. To add a language, add a
locale file there using the same message keys as `en.ts`; Astro discovers the
file and generates localized versions of the site pages automatically.

The theme control in the navigation switches between light and dark mode and
remembers the choice in the browser.

## Minecraft 伺服器啟動參數產生器

The site includes a configurable Minecraft server launch-script generator at
`/DBOP-Installtutorial/flags-generator`. Its functionality was independently
implemented, with inspiration from [flags.sh](https://flags.sh/) by
[YouHaveTrouble](https://github.com/YouHaveTrouble/flags.sh). No flags.sh
source code is used.
