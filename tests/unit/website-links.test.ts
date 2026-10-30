import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseWebsiteLinks,
  websiteCategories,
  type WebsiteCategory,
  type WebsiteLink,
} from "../../src/lib/website-links";

const readList = (name: string) =>
  readFileSync(new URL(`../../lists/${name}`, import.meta.url), "utf8");

const countByCategory = (links: WebsiteLink[], category: WebsiteCategory) =>
  links.filter((entry) => entry.categories.includes(category)).length;

describe("parseWebsiteLinks", () => {
  it("parses one or more category tags", () => {
    const links = parseWebsiteLinks(`
- [Fabric](https://fabricmc.net/) #minecraft #mods
- [7-Zip](https://www.7-zip.org/) #software
`);

    expect(links).toEqual([
      {
        link: "https://fabricmc.net/",
        altText: "Fabric",
        categories: ["minecraft", "mods"],
      },
      {
        link: "https://www.7-zip.org/",
        altText: "7-Zip",
        categories: ["software"],
      },
    ]);
  });

  it("ignores headings and blank lines", () => {
    const links = parseWebsiteLinks(`
# Useful websites

- [Prism](https://prismlauncher.org/) #minecraft #launchers
`);

    expect(links).toHaveLength(1);
  });

  it("deduplicates repeated category tags", () => {
    const [link] = parseWebsiteLinks("- [Prism](https://prismlauncher.org/) #launchers #launchers");

    expect(link.categories).toEqual(["launchers"]);
  });

  it("rejects entries without a category", () => {
    expect(() => parseWebsiteLinks("- [Prism](https://prismlauncher.org/)")).toThrow(
      /Invalid website list entry/,
    );
  });

  it("rejects unknown categories", () => {
    expect(() => parseWebsiteLinks("- [Prism](https://prismlauncher.org/) #games")).toThrow(
      /Unknown website category "games"/,
    );
  });

  it("only accepts https links", () => {
    expect(() => parseWebsiteLinks("- [Prism](http://prismlauncher.org/) #minecraft")).toThrow(
      /Invalid website list entry/,
    );
  });

  it("parses the combined website list with valid categories", () => {
    const links = parseWebsiteLinks(readList("useful-websites.md"));
    const categories = links.map((link) => link.categories);

    expect(links).toHaveLength(52);
    expect(new Set(links.map((link) => link.link)).size).toBe(links.length);

    for (const entry of categories.flat()) {
      expect(websiteCategories).toContain(entry);
    }

    expect(countByCategory(links, "minecraft")).toBe(35);
    expect(countByCategory(links, "launchers")).toBe(6);
    expect(countByCategory(links, "mods")).toBe(9);
    expect(countByCategory(links, "servers")).toBe(6);
    expect(countByCategory(links, "world")).toBe(3);
    expect(countByCategory(links, "software")).toBe(21);
    expect(countByCategory(links, "media")).toBe(6);
    expect(countByCategory(links, "security")).toBe(2);
  });
});
