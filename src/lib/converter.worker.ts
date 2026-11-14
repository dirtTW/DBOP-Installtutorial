/// <reference lib="webworker" />
/**
 * Runs je2be-core (compiled to WebAssembly) inside a worker.
 *
 * The core is a classic Emscripten build with an embedded wasm payload, so it is
 * pulled in with `importScripts` rather than imported. That only works if this
 * file is bundled as a classic (IIFE) worker, which is Vite's default
 * `worker.format`, and it is also why `FS` and `Module` below resolve to the
 * globals that core.js defines in the worker's scope.
 *
 * The C++ side reports progress with its own `postMessage`, so progress messages
 * reach the page directly; this worker only sends the final result or a failure.
 */
import JSZip from "jszip";

export type ConvertMode = "j2b" | "b2j" | "x2j" | "x2b";

export type StartMessage = {
  type: "start";
  id: string;
  mode: ConvertMode;
  file: File | FileList;
  /** Absolute URL of the Emscripten core.js, resolved by the page. */
  coreJsUrl: string;
};

export type DoneMessage = {
  type: "done";
  id: string;
  /** Zip of the converted world, contents at the archive root. */
  archive: ArrayBuffer;
  filename: string;
};

export type FailedMessage = { type: "failed"; id: string; error: string };

declare const Module: any;
declare const FS: any;
declare function importScripts(...urls: string[]): void;
declare function allocateUTF8(s: string): number;
declare function UTF8ToString(ptr: number): string;

const scope = self as unknown as DedicatedWorkerGlobalScope;

/* ------------------------------------------------------------------ emscripten */

let sRuntime: Promise<void> | undefined;

function loadRuntime(coreJsUrl: string): Promise<void> {
  if (!sRuntime) {
    sRuntime = new Promise<void>((resolve) => {
      // core.js needs two things set before it runs:
      //  - locateFile, because it spawns `core.worker.js` relative to the script's
      //    own directory, and this driver is a bundle in `_astro/`.
      //  - mainScriptUrlOrBlob, because each pthread worker is told to
      //    `importScripts` that URL. Left unset, it is `self.location.href` — this
      //    bundle — so the threads never reach core.js's pthread entry point, never
      //    post `loaded`, and the runtime stalls forever on `wasm-instantiate`.
      (self as unknown as { Module: unknown }).Module = {
        locateFile: (path: string) => new URL(path, coreJsUrl).href,
        mainScriptUrlOrBlob: coreJsUrl,
      };
      importScripts(coreJsUrl);
      if (Module.calledRun) {
        resolve();
      } else {
        Module.onRuntimeInitialized = () => resolve();
      }
    });
  }
  return sRuntime;
}

/* ------------------------------------------------------------------- tiny fs */

function exists(path: string): boolean {
  try {
    FS.stat(path);
    return true;
  } catch {
    return false;
  }
}

function mkdirp(path: string): void {
  if (!path.startsWith("/")) return;
  const parts = path.substring(1).split("/");
  for (let i = 1; i <= parts.length; i++) {
    const dir = `/${parts.slice(0, i).join("/")}`;
    if (!exists(dir)) FS.mkdir(dir);
  }
}

function dirname(path: string): string {
  const parts = path.split("/");
  return parts.slice(0, -1).join("/");
}

function writeFile(path: string, data: Uint8Array): void {
  mkdirp(dirname(path));
  FS.writeFile(path, data);
}

function readFile(path: string): Uint8Array {
  return FS.readFile(path) as Uint8Array;
}

async function readEntries(root: string): Promise<{ path: string; data: Uint8Array }[]> {
  const out: { path: string; data: Uint8Array }[] = [];
  const visit = (dir: string) => {
    for (const name of FS.readdir(dir) as string[]) {
      if (name === "." || name === "..") continue;
      const path = `${dir}/${name}`;
      const stat = FS.stat(path);
      if (FS.isDir(stat.mode)) visit(path);
      else if (FS.isFile(stat.mode)) out.push({ path, data: readFile(path) });
    }
  };
  if (exists(root)) visit(root);
  return out;
}

/** Frees a previous run's tree so repeated conversions do not grow the heap. */
function removeTree(path: string): void {
  const visit = (dir: string) => {
    for (const name of FS.readdir(dir) as string[]) {
      if (name === "." || name === "..") continue;
      const child = `${dir}/${name}`;
      const stat = FS.stat(child);
      if (FS.isDir(stat.mode)) visit(child);
      else FS.unlink(child);
    }
    if (dir !== path) FS.rmdir(dir);
  };
  if (exists(path)) visit(path);
}

/* ------------------------------------------------------------------- reading */

function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error(`${file.name} could not be read`));
    };
    reader.onerror = () => reject(new Error(`${file.name} could not be read`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Copies a directory selection into the virtual filesystem, dropping the
 * top-level folder the picker includes so the converter sees the world root.
 */
async function copyDirectory(files: FileList, into: string, id: string): Promise<void> {
  const first = files.item(0);
  if (!first) throw new Error("no files were selected");
  const prefix = first.webkitRelativePath.substring(
    0,
    first.webkitRelativePath.indexOf("/") + 1,
  );
  for (let i = 0; i < files.length; i++) {
    const item = files.item(i);
    if (!item) continue;
    const relative = item.webkitRelativePath.startsWith(prefix)
      ? item.webkitRelativePath.substring(prefix.length)
      : item.name;
    writeFile(`${into}/${relative}`, await readFileAsBytes(item));
    scope.postMessage({
      type: "progress",
      id,
      step: "copy",
      progress: (i + 1) / files.length,
      count: i + 1,
    });
  }
}

/**
 * Expands a world archive into the virtual filesystem. A world is often zipped
 * inside a wrapper folder (and a `.mcworld` always is), so the entry point of
 * the archive is located first and only that subtree is copied.
 */
async function extractArchive(file: File, into: string, marker: string, id: string): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("The file could not be opened as a zip archive.");
  }

  const candidates: string[] = [];
  zip.forEach((path) => {
    const normal = path.replace(/\\/g, "/");
    if (normal === marker || normal.endsWith(`/${marker}`)) candidates.push(normal);
  });
  if (candidates.length === 0) {
    throw new Error(
      marker === "level.dat"
        ? "No level.dat was found, so this does not look like a Minecraft world."
        : "No GAMEDATTA was found, so this does not look like a console save.",
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      "The archive holds more than one world. Unzip it and convert a single world instead.",
    );
  }

  const entry = candidates[0];
  const prefix = entry.substring(0, entry.lastIndexOf(marker));
  // Folder entries have to be dropped rather than written: `Compress-Archive` and
  // some other zippers record them as zero-byte files whose name ends in "/",
  // which JSZip does not always flag with `dir`. Writing one creates the directory
  // and then tries to write a file onto it ("Is a directory").
  const entries = Object.values(zip.files).filter((f) => {
    const name = f.name.replace(/\\/g, "/");
    return !f.dir && !name.endsWith("/") && name.startsWith(prefix);
  });
  for (let i = 0; i < entries.length; i++) {
    const entryFile = entries[i];
    const relative = entryFile.name.replace(/\\/g, "/").substring(prefix.length);
    writeFile(`${into}/${relative}`, await entryFile.async("uint8array"));
    scope.postMessage({
      type: "progress",
      id,
      step: "unzip",
      progress: (i + 1) / entries.length,
      count: i + 1,
    });
  }
}

/* ------------------------------------------------------------------- writing */

async function packDirectory(dir: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const { path, data } of await readEntries(dir)) {
    zip.file(path.substring(dir.length + 1), data);
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

/* ------------------------------------------------------------------ converting */

const MODES: Record<
  ConvertMode,
  { marker: string; entry: string; extension: string }
> = {
  j2b: { marker: "level.dat", entry: "_JavaToBedrock", extension: "mcworld" },
  b2j: { marker: "level.dat", entry: "_BedrockToJava", extension: "zip" },
  x2j: { marker: "GAMEDATTA", entry: "_Xbox360ToJava", extension: "zip" },
  x2b: { marker: "GAMEDATTA", entry: "_Xbox360ToBedrock", extension: "mcworld" },
};

async function convert(message: StartMessage): Promise<void> {
  const { id, mode, file, coreJsUrl } = message;
  const spec = MODES[mode];
  if (!spec) throw new Error(`unsupported conversion "${mode}"`);

  await loadRuntime(coreJsUrl);

  const inputPath = `/je2be/${id}/in`;
  const outputPath = `/je2be/${id}/out`;
  removeTree(`/je2be/${id}`);
  mkdirp(inputPath);
  mkdirp(outputPath);

  if (file instanceof FileList) {
    await copyDirectory(file, inputPath, id);
  } else {
    await extractArchive(file, inputPath, spec.marker, id);
  }

  Module._Init();
  const inputPtr = allocateUTF8(inputPath);
  const outputPtr = allocateUTF8(outputPath);
  const idPtr = allocateUTF8(id);
  let errorPtr = 0;
  try {
    errorPtr = Module[spec.entry](inputPtr, outputPtr, idPtr) as number;
    if (errorPtr !== 0) {
      const raw = UTF8ToString(errorPtr);
      const parsed = JSON.parse(raw) as {
        what?: string;
        trace?: { file: string; line: number }[];
      };
      // Keep the structured payload reachable from the console: it is the only
      // place the core reports which file it choked on.
      console.error(`[converter] ${spec.entry} failed`, parsed);
      const where = parsed.trace?.[0];
      throw new Error(
        `${parsed.what || "The conversion failed."}${where ? ` (${where.file}:${where.line})` : ""}`,
      );
    }
  } finally {
    Module._free(inputPtr);
    Module._free(outputPtr);
    Module._free(idPtr);
    if (errorPtr !== 0) Module._free(errorPtr);
    Module._Deinit();
  }

  const archive = await packDirectory(outputPath);
  removeTree(`/je2be/${id}`);

  const base = (file instanceof File ? file.name : id).replace(/\.(zip|mcworld)$/i, "");
  const done: DoneMessage = {
    type: "done",
    id,
    archive,
    filename: `${base}-${mode}.${spec.extension}`,
  };
  scope.postMessage(done, [archive]);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  // A failed `importScripts` or pthread spawn rejects with a bare Event, which
  // would otherwise reach the page as "[object Event]".
  if (error instanceof Event) return `the converter runtime could not start (${error.type})`;
  return String(error);
}

scope.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as StartMessage;
  if (!message || message.type !== "start") return;
  convert(message).catch((error: unknown) => {
    // The message reaches the page; the stack stays in the console.
    console.error(
      `[converter] ${message.mode} failed`,
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    const failed: FailedMessage = {
      type: "failed",
      id: message.id,
      error: describeError(error),
    };
    scope.postMessage(failed);
  });
});
