// Pull the live Claude page's recipes into the repo. Used by the hourly sync and before
// any republish from code (otherwise a publish would drop recipes Brian added on the site).
//
//   node scripts/pull-live.mjs <saved index.html> [--assets <dir>]
//
// 1. Save the live page (Claude: Artifact read, path "index.html").
// 2. List the photo ids it needs:      node scripts/pull-live.mjs <file> --list-missing
//    Download each one into <dir>      (Claude: Artifact read, path "<id>", out_dir <dir>)
// 3. Run with --assets <dir>: new photos are copied to public/photos/<slug>.<ext>, added to
//    scripts/photo-assets.json, and recipes.json is rewritten. Prints CHANGED or UNCHANGED.
//
// Exit codes: 0 ok · 1 bad input · 2 a photo is still missing (download it and rerun).
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const file = args[0];
const assetsDir = args.includes("--assets") ? args[args.indexOf("--assets") + 1] : null;
const listMissing = args.includes("--list-missing");
if (!file) { console.error("Usage: node scripts/pull-live.mjs <saved index.html> [--assets <dir>] [--list-missing]"); process.exit(1); }

const html = fs.readFileSync(file, "utf8");
// The page's own script also contains this tag text, so take the first match (the data block comes first).
const m = html.match(/<script type="application\/json" id="recipe-data">([\s\S]*?)<\/script>/);
if (!m) { console.error("No recipe data found in that file."); process.exit(1); }
let live;
try { live = JSON.parse(m[1]); } catch { console.error("Recipe data isn't valid JSON."); process.exit(1); }
if (!Array.isArray(live) || live.some((r) => typeof r?.slug !== "string" || typeof r?.title !== "string")) {
  console.error("Recipe data doesn't look like a recipe list."); process.exit(1);
}

const MAP = "scripts/photo-assets.json";
const map = JSON.parse(fs.readFileSync(MAP, "utf8")); // file name → asset id
const fileForId = Object.fromEntries(Object.entries(map).map(([name, id]) => [id, name]));
const blobId = (p) => (typeof p === "string" && /^\/_blob\/[0-9a-f]{32}$/.test(p) ? p.slice(7) : null);

const missing = [...new Set(live.map((r) => blobId(r.photo)).filter((id) => id && !fileForId[id]))];
if (listMissing) { console.log(missing.join("\n")); process.exit(0); }

let stillMissing = 0;
for (const id of missing) {
  const found = assetsDir && fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).find((f) => f.startsWith(id))
    : null;
  if (!found) { console.error("Missing photo for asset", id); stillMissing++; continue; }
  const recipe = live.find((r) => blobId(r.photo) === id);
  const ext = (path.extname(found) || ".webp").toLowerCase().replace(".jpeg", ".jpg");
  if (![".webp", ".jpg", ".png"].includes(ext)) { console.error("Unexpected photo type", found); stillMissing++; continue; }
  let name = recipe.slug.replace(/[^a-z0-9-]/g, "") + ext;
  for (let n = 2; map[name] && map[name] !== id; n++) name = `${recipe.slug}-${n}${ext}`;
  fs.copyFileSync(path.join(assetsDir, found), path.join("public/photos", name));
  map[name] = id;
  fileForId[id] = name;
}
if (stillMissing) process.exit(2);

const recipes = live.map((r) => {
  const id = blobId(r.photo);
  return id && fileForId[id] ? { ...r, photo: "photos/" + fileForId[id] } : r;
});

const before = fs.readFileSync("src/data/recipes.json", "utf8");
const after = JSON.stringify(recipes, null, 2) + "\n";
fs.writeFileSync(MAP, JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 2) + "\n");
fs.writeFileSync("src/data/recipes.json", after);
console.log(before === after ? "UNCHANGED" : "CHANGED", `(${JSON.parse(before).length} → ${recipes.length} recipes)`);
