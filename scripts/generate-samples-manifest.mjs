// scripts/generate-samples-manifest.mjs
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve("public", "sounds");
const OUT  = path.resolve("public", "samples.manifest.json");

function niceName(file) {
  const base = file.replace(/\.[^/.]+$/,"");       // drop extension
  const deNum = base.replace(/^\s*\d+\s*[-_.]?\s*/,""); // drop leading numbers
  return deNum
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

async function run() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const categories = [];

  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    const cat = dirent.name;                      // e.g. "kick"
    const catDir = path.join(ROOT, cat);
    const files = await fs.readdir(catDir);
    const items = files
      .filter((f) => /\.wav$/i.test(f))
      .map((f) => ({
        id: `${cat}/${f}`,
        name: niceName(f),
        src: `/sounds/${cat}/${f}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    categories.push({
      id: cat,
      name: niceName(cat),
      items,
    });
  }

  categories.sort((a, b) => a.name.localeCompare(b.name));
  await fs.writeFile(OUT, JSON.stringify({ categories }, null, 2), "utf8");
  console.log(`✓ Wrote ${OUT} with ${categories.reduce((n,c)=>n+c.items.length,0)} samples.`);
}
run().catch((e) => { console.error(e); process.exit(1); });
