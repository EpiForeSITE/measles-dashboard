// After `vite build`: copies epiworldjs (src/ and dist/, which it needs side
// by side) into dist/epiworldjs/ and writes the standalone pages that load
// the built bundle.

import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const epiworldjs = join(root, "node_modules", "epiworldjs");

for (const dir of ["src", "dist"])
  cpSync(join(epiworldjs, dir), join(out, "epiworldjs", dir), { recursive: true });
for (const file of ["LICENSE", "package.json"])
  cpSync(join(epiworldjs, file), join(out, "epiworldjs", file));

for (const page of ["index.html", "embed.html"]) {
  const html = readFileSync(join(root, page), "utf8")
    .replace('src="/src/index.js"', 'src="./measles-dashboard.js"');
  writeFileSync(join(out, page), html);
}
console.log("postbuild: copied epiworldjs and pages into dist/");
