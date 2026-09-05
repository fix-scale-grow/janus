import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = require.resolve("maplibre-gl/package.json");
const distDir = join(dirname(pkgPath), "dist");
const targetDir = join(here, "..", "public", "vendor", "maplibre-gl");

mkdirSync(targetDir, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
	copyFileSync(join(distDir, file), join(targetDir, file));
}

console.log(`Synced maplibre-gl worker assets to ${targetDir}`);
