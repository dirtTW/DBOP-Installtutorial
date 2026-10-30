# Website lists

Edit the Markdown files in this folder to update the website cards shown on the
site. Keep one link per line and add at least one category tag:

```markdown
- [Website name](https://example.com) #software
```

Available category tags:

- `minecraft` — Minecraft resources
- `launchers` — game launchers
- `mods` — mod platforms and mods
- `servers` — server software and server tools
- `world` — maps and world conversion tools
- `software` — software, utilities, and everyday tools
- `media` — media download and editing tools
- `security` — security and scanning tools

An entry can have several tags, for example:

```markdown
- [Prism Launcher](https://prismlauncher.org/) #minecraft #launchers
```

The label is used when no translated site label is available. The website page
searches both the displayed label and the link URL, and filters by these tags.

`recommended-modpacks.md` uses its own `link:` format because the modpack page
can fetch Modrinth metadata and supports optional CurseForge image URLs. Its
header explains how to add entries.
