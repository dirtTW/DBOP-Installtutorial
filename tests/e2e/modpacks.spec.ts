import { expect, test } from "@playwright/test";

const card = "#modpack-list > article";
const status = "#modpack-search-status";
const search = "#modpack-search";
const clear = "#modpack-search-clear";

test.describe("recommended modpacks search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("recommended-modpacks/");
  });

  test("lists every modpack and hides the clear button", async ({ page }) => {
    await expect(page.locator(card)).toHaveCount(13);
    await expect(page.locator(status)).toHaveText("13 modpack(s) total");
    await expect(page.locator(clear)).toBeHidden();
  });

  test("filters modpacks as you type", async ({ page }) => {
    await page.locator(search).fill("basement");

    await expect(page.locator(`${card}:visible`)).toHaveCount(1);
    await expect(page.locator(`${card}:visible`)).toContainText(
      "DirtTW's Basement Optimize Pack",
    );
    await expect(page.locator(status)).toHaveText("1 modpack(s) found");
    await expect(page.locator(clear)).toBeVisible();
  });

  test("reports when a search has no matches", async ({ page }) => {
    await page.locator(search).fill("no-such-modpack");

    await expect(page.locator(`${card}:visible`)).toHaveCount(0);
    await expect(page.locator(status)).toHaveText(
      'No modpacks found for "no-such-modpack"',
    );
  });

  test("clears the search with the clear button", async ({ page }) => {
    await page.locator(search).fill("zgc");
    await expect(page.locator(`${card}:visible`)).toHaveCount(0);
    await expect(page.locator(clear)).toBeVisible();

    await page.locator(clear).click();

    await expect(page.locator(search)).toHaveValue("");
    await expect(page.locator(`${card}:visible`)).toHaveCount(13);
    await expect(page.locator(status)).toHaveText("13 modpack(s) total");
    await expect(page.locator(clear)).toBeHidden();
    await expect(page.locator(search)).toBeFocused();
  });

  test("clears the search with Escape", async ({ page }) => {
    await page.locator(search).fill("dbop");
    await expect(page.locator(`${card}:visible`)).toHaveCount(1);

    await page.locator(search).press("Escape");

    await expect(page.locator(search)).toHaveValue("");
    await expect(page.locator(`${card}:visible`)).toHaveCount(13);
  });

  test("localizes the status and clear button", async ({ page }) => {
    await page.goto("zh-TW/recommended-modpacks/");

    await expect(page.locator(status)).toHaveText("共 13 個模組包");

    await page.locator(search).fill("no-such-pack");

    await expect(page.locator(status)).toHaveText(
      "找不到符合「no-such-pack」的模組包",
    );
    await expect(page.getByRole("button", { name: "清除搜尋" })).toBeVisible();
  });
});
