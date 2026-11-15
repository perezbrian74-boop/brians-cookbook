import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { scriptJson } from "./src/lib/pageTemplate.js";

// Recipes ship as data in the page (not in the JS bundle), so the live page can
// republish itself with an updated list. This injects them into index.html.
function recipeData() {
  return {
    name: "recipe-data",
    transformIndexHtml(html) {
      const recipes = JSON.parse(fs.readFileSync("src/data/recipes.json", "utf8"));
      return html.replace(
        '<div id="root"></div>',
        `<script type="application/json" id="recipe-data">${scriptJson(recipes)}</script>\n    <div id="root"></div>`,
      );
    },
  };
}

// base "./" keeps photo paths relative so the site works on any host.
// singlefile inlines JS + CSS into index.html; photos stay as files in /photos.
export default defineConfig({
  base: "./",
  plugins: [react(), recipeData(), viteSingleFile()],
});
