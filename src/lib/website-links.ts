export interface WebsiteLink {
  link: string;
  altText: string;
}

export function parseWebsiteLinks(markdown: string): WebsiteLink[] {
  const links: WebsiteLink[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith("#")) continue;

    const match = entry.match(/^- \[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (!match) {
      throw new Error(`Invalid website list entry: ${entry}`);
    }

    const [, altText, link] = match;
    links.push({ link, altText });
  }

  return links;
}
