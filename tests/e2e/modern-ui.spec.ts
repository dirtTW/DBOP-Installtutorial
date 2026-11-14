import { expect, test } from "@playwright/test";

/**
 * Modernisation checks: dark mode via <meta name="color-scheme">, a native
 * popover navigation, self-hosted fonts, view-transition opt-in and deferred
 * rendering. These assert behaviour a static HTML diff cannot show.
 */

test.describe("color scheme", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
  });

  test("follows the system preference without script state", async ({ page }) => {
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "light dark",
    );
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light dark");
    // The old implementation toggled a `.dark` class; it must be gone.
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("pins a scheme through the meta tag and persists it", async ({ page }) => {
    const before = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    await page.locator("[data-theme-toggle]").click();

    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "dark",
    );
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    // md-icon-button delegates ARIA to its inner shadow button, so the host
    // keeps the value in `data-aria-label` and the accessible name is what
    // assistive tech (and Playwright's role engine) actually reads.
    await expect(
      page.getByRole("button", { name: "Switch to light mode" }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .not.toBe(before);

    await page.reload();
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "dark",
    );
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

    // Toggling back to the scheme the OS already uses removes the override.
    await page.locator("[data-theme-toggle]").click();
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "light dark",
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("theme")))
      .toBeNull();
  });

  test("follows the OS without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: "dark",
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto("./");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light dark");
    // `light dark` resolves to dark through the OS preference.
    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe("rgb(17, 19, 24)");
    await context.close();
  });
});

test.describe("popover navigation", () => {
  test("narrow layout opens a native popover menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");

    const menu = page.locator("#navbar-menu");
    const toggle = page.locator("#nav-toggle");

    await expect(menu).toHaveAttribute("popover", "auto");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).not.toBeVisible();

    await toggle.click();
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await menu.evaluate((el) => el.matches(":popover-open"))).toBe(true);

    // Escape is handled natively by the popover, no listener of ours.
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("wide layout turns the same list into inline navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("./");

    const menu = page.locator("#navbar-menu");
    await expect(menu).not.toHaveAttribute("popover", /.*/);
    await expect(menu).toBeVisible();
    await expect(page.locator("#nav-toggle")).toBeHidden();
    await expect(page.getByRole("link", { name: "Useful websites" })).toBeVisible();
  });

  test("language picker is a popover and switches locale", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");

    const picker = page.locator("#language-menu");
    const trigger = page.locator("#language-toggle");

    await expect(picker).toHaveAttribute("popover", "auto");
    await trigger.click();
    await expect(picker).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await picker.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(/\/zh-TW\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  });
});

test.describe("page chrome", () => {
  test("offers a skip link that focuses the main landmark", async ({ page }) => {
    await page.goto("./");
    await page.keyboard.press("Tab");

    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("loads no third-party font or stylesheet requests", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== new URL(page.url()).origin) external.push(url.host);
    });

    await page.goto("./");
    await page.waitForLoadState("networkidle");

    expect(external.filter((host) => /fonts\.(googleapis|gstatic)\.com/.test(host))).toEqual([]);
  });

  test("self-hosted fonts are available", async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => document.fonts.ready);

    expect(
      await page.evaluate(() => document.fonts.check('16px "Roboto"')),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        document.fonts.check('24px "Material Symbols Outlined"'),
      ),
    ).toBe(true);
  });

  test("opts into cross-document view transitions", async ({ page }) => {
    await page.goto("./");
    const css = await page.evaluate(() =>
      Array.from(document.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules).map((rule) => rule.cssText);
          } catch {
            return [];
          }
        })
        .join("\n"),
    );
    expect(css).toContain("@view-transition");
    expect(css).toContain("navigation: auto");
  });

  test("defers rendering of below-the-fold directory cards", async ({ page }) => {
    await page.goto("useful-website/");

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            getComputedStyle(
              document.querySelector("#useful-website-list > a:nth-child(7)")!,
            ).contentVisibility,
        ),
      )
      .toBe("auto");
    // The first row stays fully rendered (above the fold).
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector("#useful-website-list > a:nth-child(1)")!,
          ).contentVisibility,
      ),
    ).toBe("visible");
  });
});
