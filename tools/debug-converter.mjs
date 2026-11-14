// Drives the converter page in Chrome and prints everything the page, its
// workers and the network report, so a stalled conversion can be diagnosed
// without waiting for the 9-minute test timeout.
//
// usage: node tools/debug-converter.mjs <baseUrl> <sampleWorld.zip> [waitMs]
import { chromium } from "@playwright/test";

const [baseUrl, sampleWorld, waitMs = "45000"] = process.argv.slice(2);
if (!baseUrl || !sampleWorld) {
  console.error("usage: node tools/debug-converter.mjs <baseUrl> <world.zip> [waitMs]");
  process.exit(2);
}

const stamp = () => new Date().toISOString().slice(11, 23);

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (msg) => console.log(`${stamp()} [page:${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => console.log(`${stamp()} [pageerror] ${err.message}`));
page.on("requestfailed", (req) =>
  console.log(`${stamp()} [requestfailed] ${req.url()} :: ${req.failure()?.errorText}`),
);
page.on("response", (res) => {
  if (res.status() >= 400) console.log(`${stamp()} [http ${res.status()}] ${res.url()}`);
});
page.on("worker", (worker) => {
  console.log(`${stamp()} [worker] ${worker.url()}`);
  worker.on("console", (msg) =>
    console.log(`${stamp()} [worker:${msg.type()}] ${msg.text()}`),
  );
  worker.on("close", () => console.log(`${stamp()} [worker closed] ${worker.url()}`));
});

console.log(`${stamp()} goto ${baseUrl}`);
await page.goto(`${baseUrl}world-converter/`, { waitUntil: "load" });
await page.waitForTimeout(1500);

let isolated = await page.evaluate(() => self.crossOriginIsolated);
console.log(`${stamp()} crossOriginIsolated=${isolated}`);
if (!isolated) {
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);
  isolated = await page.evaluate(() => self.crossOriginIsolated);
  console.log(`${stamp()} after reload crossOriginIsolated=${isolated}`);
}

await page.locator("#archive-input").setInputFiles(sampleWorld);
await page.getByRole("button", { name: "Convert" }).click();
console.log(`${stamp()} clicked Convert`);

const deadline = Date.now() + Number(waitMs);
let last = "";
while (Date.now() < deadline) {
  await page.waitForTimeout(1000);
  const text = (await page.locator("#selection").innerText()).trim();
  if (text !== last) {
    console.log(`${stamp()} status: ${text}`);
    last = text;
  }
}

const memory = await page.evaluate(() => {
  const global = /** @type {any} */ (self);
  return {
    // Emscripten's heap, if the runtime is up; undefined otherwise.
    heap: typeof global.Module === "undefined" ? "no Module" : "Module present",
  };
});
console.log(`${stamp()} ${JSON.stringify(memory)}`);
console.log(`${stamp()} final status: ${last}`);
await browser.close();
