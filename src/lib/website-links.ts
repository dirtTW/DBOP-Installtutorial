export const websiteCategories = [
  "minecraft",
  "launchers",
  "mods",
  "servers",
  "world",
  "software",
  "media",
  "security",
] as const;

export type WebsiteCategory = (typeof websiteCategories)[number];

export interface WebsiteLink {
  link: string;
  altText: string;
  categories: WebsiteCategory[];
}

const entryPattern =
  /^- \[([^\]]+)\]\((https:\/\/[^)\s]+)\)((?:\s+#[a-z-]+)+)$/;
const tagPattern = /#([a-z-]+)/g;

export function parseWebsiteLinks(markdown: string): WebsiteLink[] {
  const links: WebsiteLink[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#")) continue;

    const match = entry.match(entryPattern);
    if (!match) {
      throw new Error(
        `Invalid website list entry: ${entry}. Expected "- [Name](https://example.com) #category".`,
      );
    }

    const [, altText, link, tagSource] = match;
    const categories = [...tagSource.matchAll(tagPattern)].map(
      ([, tag]) => tag as WebsiteCategory,
    );

    for (const category of categories) {
      if (!websiteCategories.includes(category)) {
        throw new Error(
          `Unknown website category "${category}" in entry: ${entry}. Allowed: ${websiteCategories.join(", ")}.`,
        );
      }
    }

    links.push({ link, altText, categories: [...new Set(categories)] });
  }

  return links;
}
