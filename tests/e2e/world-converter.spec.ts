import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

const status = "#selection";
const payload = new URL("../../public/converter/core.js", import.meta.url);
// A zip of a real Java Edition world. Kept out of the repository because it is
// megabytes of test data: point CONVERTER_SAMPLE_WORLD at one to run the test.
const sampleWorld = process.env.CONVERTER_SAMPLE_WORLD;

test.describe("world converter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("world-converter/");
  });

  test("starts on Java to Bedrock and waits for a world", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Java and Bedrock",
    );
    await expect(
      page.getByRole("button", { name: "Java to Bedrock" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Convert" })).toBeDisabled();
    await expect(page.locator(status)).toContainText("Choose a world to begin.");
  });

  test("says the conversion happens on the visitor's machine", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toContainText(
      "inside your own browser, on your own computer",
    );
    await expect(main).toContainText("Nothing is uploaded");
    await expect(main).toContainText("je2be-core");
  });

  test("credits the original converter and links to its site", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toContainText("kbinani");
    await expect(main).toContainText("The original converter is");

    const home = page.getByRole("link", { name: "je2be", exact: true });
    await expect(home).toHaveAttribute("href", "https://je2be.app/");
    // External links open in a new tab without handing over the opener.
    await expect(home).toHaveAttribute("target", "_blank");
    await expect(home).toHaveAttribute("rel", /noopener/);
    await expect(home).toHaveAttribute("rel", /noreferrer/);
  });

  test("only offers a folder for console saves", async ({ page }) => {
    await expect(page.locator("#choose-archive")).toBeVisible();

    await page.getByRole("button", { name: "Xbox 360 to Java" }).click();

    await expect(page.locator("#choose-archive")).toBeHidden();
    await expect(page.locator("#choose-folder")).toBeVisible();
    await expect(page.locator("#direction-hint")).toContainText(
      "extracted Xbox 360 save folder",
    );
  });

  test("shows the chosen world name and enables the conversion", async ({
    page,
  }) => {
    await page.locator("#archive-input").setInputFiles({
      name: "my-world.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0005\u0006" + "\u0000".repeat(18), "binary"),
    });

    await expect(page.locator(status)).toContainText("my-world.zip");
    await expect(page.getByRole("button", { name: "Convert" })).toBeEnabled();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.locator(status)).toContainText("Choose a world to begin.");
    await expect(page.getByRole("button", { name: "Convert" })).toBeDisabled();
  });

  test("references the isolation service worker by a path that exists", async ({
    page,
  }) => {
    // The worker needs SharedArrayBuffer, which needs COOP/COEP from the service
    // worker. A base path joined without a slash ("/DBOP-Installtutorialcoi-...")
    // silently 404s, so the URL is resolved and fetched rather than pattern-matched.
    const script = page.locator('script[src$="coi-serviceworker.js"]');
    await expect(script).toHaveAttribute("src", /\/coi-serviceworker\.js$/);

    const src = await script.getAttribute("src");
    expect(src).not.toBeNull();
    const response = await page.request.get(new URL(src!, page.url()).href);
    expect(response.status()).toBe(200);
  });

  test("serves the pthread worker next to the core it belongs to", async ({
    page,
  }) => {
    // core.js spawns `core.worker.js` through locateFile. It has to be fetchable
    // from the payload directory: resolving it against the driver bundle in
    // `_astro/` is what made every conversion fail with a bare Event.
    test.skip(!existsSync(payload), "the built converter payload is absent");

    // Relative to the page's own directory, so step up out of `world-converter/`.
    const workerUrl = new URL("../converter/core.worker.js", page.url()).href;
    const response = await page.request.get(workerUrl);
    expect(response.status()).toBe(200);
  });

  test("explains itself when the converter payload is missing", async ({ page }) => {
    test.skip(existsSync(payload), "the built converter payload is present");

    await page.locator("#archive-input").setInputFiles({
      name: "my-world.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0005\u0006" + "\u0000".repeat(18), "binary"),
    });
    await page.getByRole("button", { name: "Convert" }).click();

    await expect(page.locator(status)).toContainText("The conversion failed", {
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Convert" })).toBeEnabled();
  });

  test("converts a real world into a Bedrock archive", async ({ page }) => {
    test.skip(!existsSync(payload), "the built converter payload is absent");
    test.skip(!sampleWorld, "set CONVERTER_SAMPLE_WORLD to a zipped world");
    test.setTimeout(10 * 60 * 1000);

    await page.goto("world-converter/");

    // The service worker that adds COOP/COEP reloads the page once when it first
    // takes control; without it there is no SharedArrayBuffer and no conversion.
    if (!(await page.evaluate(() => self.crossOriginIsolated))) {
      await page.reload();
    }
    await expect
      .poll(() => page.evaluate(() => self.crossOriginIsolated), { timeout: 30_000 })
      .toBe(true);

    await page.locator("#archive-input").setInputFiles(sampleWorld!);
    await expect(page.getByRole("button", { name: "Convert" })).toBeEnabled();
    await page.getByRole("button", { name: "Convert" }).click();

    await expect(page.locator(status)).toContainText("is ready to download", {
      timeout: 9 * 60 * 1000,
    });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download converted world" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/-j2b\.mcworld$/);

    const saved = join(tmpdir(), `je2be-e2e-${Date.now()}.mcworld`);
    await download.saveAs(saved);

    // A Bedrock world is a level.dat plus a LevelDB directory; the point of the
    // check is that the conversion produced a world and not an empty archive.
    const zip = await JSZip.loadAsync(readFileSync(saved));
    const names = Object.keys(zip.files);
    expect(names).toContain("level.dat");
    expect(names.some((name) => name.startsWith("db/"))).toBe(true);
  });
});
