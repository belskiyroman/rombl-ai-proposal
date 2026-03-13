import { mkdir, rm, copyFile } from "node:fs/promises";
import { watch as watchFs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { build, context } from "esbuild";

const workspaceRoot = process.cwd();
const extensionRoot = path.join(workspaceRoot, "chrome-extension");
const outdir = path.join(extensionRoot, "dist");
const watchMode = process.argv.includes("--watch");

const staticFiles = ["manifest.json", "popup.html", "options.html", "sidepanel.html", "styles.css"];

function extensionPath(...segments) {
  return path.join(extensionRoot, ...segments);
}

async function copyStaticFiles() {
  await mkdir(outdir, {
    recursive: true
  });

  await Promise.all(
    staticFiles.map((filename) =>
      copyFile(extensionPath(filename), path.join(outdir, filename))
    )
  );
}

const buildOptions = {
  entryPoints: {
    background: extensionPath("src/background.ts"),
    content: extensionPath("src/content.ts"),
    options: extensionPath("src/options.ts"),
    popup: extensionPath("src/popup.ts"),
    sidepanel: extensionPath("src/sidepanel.ts")
  },
  bundle: true,
  format: "iife",
  legalComments: "none",
  outdir,
  platform: "browser",
  sourcemap: true,
  target: "chrome114"
};

if (!watchMode) {
  await rm(outdir, {
    recursive: true,
    force: true
  });
  await build(buildOptions);
  await copyStaticFiles();
  process.exit(0);
}

const builder = await context(buildOptions);
await builder.watch();
await copyStaticFiles();

const staticWatcher = watchFs(extensionRoot, { recursive: true }, async (_eventType, filename) => {
  if (!filename || filename.startsWith("dist/") || !staticFiles.includes(path.basename(filename))) {
    return;
  }

  await copyStaticFiles();
});

process.on("SIGINT", async () => {
  staticWatcher.close();
  await builder.dispose();
  process.exit(0);
});

await new Promise(() => {});
