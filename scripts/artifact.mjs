// Builds dist-artifact/index.html: the page content Claude publishes to the live artifact.
// Photos point at the artifact's photo storage (/_blob/<id>) instead of photos/ files, so the
// page can republish itself without depending on any other published file.
import fs from "node:fs";
import { renderContent } from "../src/lib/pageTemplate.js";

const html = fs.readFileSync("dist/index.html", "utf8");
// The bundle itself contains <style>/<script> text (the page template), so take the JS
// block first, then look for the stylesheet only in what's left.
const jsTag = html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
const js = jsTag[1];
const rest = html.replace(jsTag[0], "");
const css = rest.match(/<style rel="stylesheet" crossorigin>([\s\S]*?)<\/style>/)[1];

const assets = JSON.parse(fs.readFileSync("scripts/photo-assets.json", "utf8"));
const recipes = JSON.parse(fs.readFileSync("src/data/recipes.json", "utf8")).map((r) => {
  if (!r.photo?.startsWith("photos/")) return r;
  const id = assets[r.photo.slice("photos/".length)];
  if (!id) throw new Error(`No uploaded photo for ${r.photo}. Upload it as an artifact asset and add it to scripts/photo-assets.json.`);
  return { ...r, photo: "/_blob/" + id };
});

fs.mkdirSync("dist-artifact", { recursive: true });
fs.writeFileSync("dist-artifact/index.html", renderContent({ css, js, recipes }));
console.log("dist-artifact/index.html", fs.statSync("dist-artifact/index.html").size, "bytes,", recipes.length, "recipes");
