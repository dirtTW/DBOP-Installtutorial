import { expect, test } from "@playwright/test";

const output = "#script-output";

test.describe("server flags generator presets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("flags-generator/");
  });

  test("uses Aikar's flags by default", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Aikar's Flags" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(output)).toContainText("-Xms4096M -Xmx4096M");
    await expect(page.locator(output)).toContainText("-XX:+UseG1GC");
    await expect(page.locator(output)).toContainText(
      "-Dusing.aikars.flags=https://mcflags.emc.gs",
    );
    await expect(page.locator(output)).toContainText("--nogui");
  });

  test("tunes Aikar's flags for heaps of 12 GB or more", async ({ page }) => {
    await page.getByRole("button", { name: "Set memory to 12 GB" }).click();

    await expect(page.locator(output)).toContainText("-XX:G1NewSizePercent=40");
    await expect(page.locator(output)).toContainText("-XX:G1HeapRegionSize=16M");
    await expect(page.locator(output)).toContainText("-XX:G1ReservePercent=15");
  });

  test("switches to the basic preset", async ({ page }) => {
    await page.getByRole("button", { name: "Basic" }).click();

    await expect(page.getByRole("button", { name: "Basic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Aikar's Flags" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(output)).toContainText(
      'java -Xms4096M -Xmx4096M --add-modules=jdk.incubator.vector -jar "server.jar" --nogui',
    );
    await expect(page.locator(output)).not.toContainText("UseG1GC");
  });

  test("switches between ZGC and Shenandoah flags", async ({ page }) => {
    await page.getByRole("button", { name: "ZGC" }).click();
    await expect(page.locator(output)).toContainText("-XX:+UseZGC");
    await expect(page.locator(output)).toContainText("-XX:TrimNativeHeapInterval=5000");

    await page.getByRole("button", { name: "Shenandoah" }).click();
    await expect(page.locator(output)).toContainText("-XX:+UseShenandoahGC");
    await expect(page.locator(output)).toContainText("-XX:ShenandoahGCMode=iu");
  });

  test("velocity preset drops --nogui and disables the GUI switch", async ({
    page,
  }) => {
    await page.locator("#enable-gui input").check();
    await page.getByRole("button", { name: "Velocity / Proxy" }).click();

    const gui = page.locator("#enable-gui input");
    await expect(gui).toBeDisabled();
    await expect(gui).not.toBeChecked();
    await expect(page.locator(output)).toContainText("-XX:MaxInlineLevel=15");
    await expect(page.locator(output)).not.toContainText("--nogui");
  });

  test("ignore Java version adds the Paper property", async ({ page }) => {
    const ignoreVersion = page.locator("#ignore-java-version input");
    await ignoreVersion.check();

    await expect(page.locator(output)).toContainText(
      "-Dpaper.ignoreJavaVersion=true",
    );

    await page.getByRole("button", { name: "Basic" }).click();
    await expect(ignoreVersion).toBeDisabled();
    await expect(ignoreVersion).not.toBeChecked();
    await expect(page.locator(output)).not.toContainText(
      "-Dpaper.ignoreJavaVersion=true",
    );
  });
});
