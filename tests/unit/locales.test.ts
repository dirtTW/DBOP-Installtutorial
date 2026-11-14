import { describe, expect, it } from "vitest";
import en from "../../src/i18n/locales/en";
import zhTW from "../../src/i18n/locales/zh-TW";

/**
 * Lists every leaf of a dictionary as a path, so two dictionaries can be compared
 * structurally. Message values are functions in a few places, and those are
 * reduced to `path()`.
 */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}()`];
  if (Array.isArray(value)) return [`${path}[]`];
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      shape(child, path ? `${path}.${key}` : key),
    );
  }
  return [path];
}

describe("locale dictionaries", () => {
  // `siteLabels` maps a link to its translated site name, and a locale is free to
  // translate only some of the directory, so its keys legitimately differ.
  const withoutSiteLabels = (dictionary: object) =>
    Object.fromEntries(
      Object.entries(dictionary).filter(([key]) => key !== "siteLabels"),
    );

  const english = shape(withoutSiteLabels(en)).sort();

  it("covers every English message", () => {
    expect(shape(withoutSiteLabels(zhTW)).sort()).toEqual(english);
  });

  it("has no message English does not have", () => {
    const chinese = shape(withoutSiteLabels(zhTW));
    expect(english.filter((key) => !chinese.includes(key))).toEqual([]);
  });
});
