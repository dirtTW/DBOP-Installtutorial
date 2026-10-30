import { expect, test } from "@playwright/test";

const card = "#useful-website-list > a";
const status = "[data-website-search-status]";
const search = "[data-website-search]";

test.describe("unified useful websites directory", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("zh-TW/useful-website/");
  });

  test("shows the merged list of Minecraft and software links", async ({ page }) => {
    await expect(page.locator(card)).toHaveCount(52);
    await expect(page.locator(status)).toHaveText("共 52 個網站");
    await expect(page.getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("filters by a single category", async ({ page }) => {
    await page.getByRole("button", { name: "啟動器" }).click();

    await expect(page.getByRole("button", { name: "啟動器" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator(`${card}:visible`)).toHaveCount(6);
    await expect(page.locator(status)).toHaveText("共 6 個網站");
  });

  test("combines the category filter with search", async ({ page }) => {
    await page.getByRole("button", { name: "模組平台" }).click();
    await page.locator(search).fill("fabric");

    await expect(page.locator(`${card}:visible`)).toHaveCount(1);
    await expect(page.locator(`${card}:visible`)).toContainText("Fabric");
    await expect(page.locator(status)).toHaveText("找到 1 個網站");
  });

  test("keeps search results inside the active category", async ({ page }) => {
    await page.getByRole("button", { name: "啟動器" }).click();
    await page.locator(search).fill("minecraft");

    await expect(page.locator(`${card}:visible`)).toHaveCount(1);
    await expect(page.locator(`${card}:visible`)).toContainText("Minecraft 官方啟動器下載");
  });

  test("reports when a search has no matches", async ({ page }) => {
    await page.locator(search).fill("no-such-website");

    await expect(page.locator(`${card}:visible`)).toHaveCount(0);
    await expect(page.locator(status)).toHaveText("找不到符合「no-such-website」的網站");
  });

  test("resets back to the full list", async ({ page }) => {
    await page.getByRole("button", { name: "安全性" }).click();
    await expect(page.locator(`${card}:visible`)).toHaveCount(2);

    await page.getByRole("button", { name: "全部" }).click();

    await expect(page.locator(`${card}:visible`)).toHaveCount(52);
    await expect(page.locator(status)).toHaveText("共 52 個網站");
  });

  test("old Minecraft page redirects to the unified page", async ({ page }) => {
    await page.goto("zh-TW/minecraft-useful-website/");

    await expect(page).toHaveURL(/\/zh-TW\/useful-website\/?$/);
    await expect(page.locator(card)).toHaveCount(52);
  });

  test("English page uses the same directory", async ({ page }) => {
    await page.goto("useful-website/");

    await expect(page.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(status)).toHaveText("52 website(s) total");
  });
});
