// Extracts the wasm payload that `-sSINGLE_FILE=1` embeds in core.js and tries to
// compile it, so a module that the browser refuses to instantiate shows up here
// instead of as a conversion that never finishes.
//
// usage: node tools/check-embedded-wasm.mjs <core.js>
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const path = process.argv[2];
if (!path) {
  console.error("usage: node tools/check-embedded-wasm.mjs <core.js>");
  process.exit(2);
}

const source = readFileSync(path, "utf8");
const marker = "base64,";

// core.js mentions the marker more than once (data-URI tests as well as the
// payload itself), so take the longest run of base64 characters that follows one.
let base64 = "";
let searchFrom = 0;
while (true) {
  const at = source.indexOf(marker, searchFrom);
  if (at < 0) break;
  searchFrom = at + marker.length;
  let end = searchFrom;
  while (end < source.length && /[A-Za-z0-9+/=]/.test(source[end])) end++;
  if (end - searchFrom > base64.length) base64 = source.slice(searchFrom, end);
}
if (!base64) {
  console.error("no base64 payload found; is this a -sSINGLE_FILE build?");
  process.exit(1);
}
console.log(`payload: ${base64.length} base64 chars (~${Math.round((base64.length * 3) / 4 / 1048576)} MiB)`);

const bytes = Buffer.from(base64, "base64");
// Written outside the payload directory so a diagnostic run never leaves a
// 16 MiB artifact next to the files the site serves.
const out = join(tmpdir(), basename(path).replace(/\.js$/, ".embedded.wasm"));
writeFileSync(out, bytes);
console.log(`wrote ${out}: ${bytes.length} bytes, magic=${bytes.subarray(0, 4).toString("hex")}`);

const started = Date.now();
try {
  const module = await WebAssembly.compile(bytes);
  const exports = WebAssembly.Module.exports(module).map((e) => e.name);
  console.log(`compiled in ${Date.now() - started} ms; exports: ${exports.filter((n) => /^_?(Init|Deinit|JavaToBedrock|BedrockToJava)$/.test(n)).join(", ")}`);
} catch (error) {
  console.error(`compile failed in ${Date.now() - started} ms: ${error}`);
  process.exit(1);
}
