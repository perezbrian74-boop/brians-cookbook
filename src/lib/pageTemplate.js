// The live page's own document, as one template. Used by:
//  - scripts/artifact.mjs (Node) to build the page Claude publishes
//  - src/lib/save.js (browser) when Brian saves a recipe and the page republishes itself
// Keep both paths on this file so a save reproduces the page exactly.

// The wrapper the Claude artifact host puts around every page. A page that publishes
// itself must send this exact prefix so later publishes recognize and replace it.
export const SKELETON_START =
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
export const SKELETON_END = "</body></html>";

const HEAD = `<title>Brian's Cookbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Brian's personal recipe collection.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">`;

/** JSON that is safe inside a <script> element. */
export function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The page content (everything inside <body>). */
export function renderContent({ css, js, recipes }) {
  return [
    HEAD,
    `<style id="app-css">${css}</style>`,
    `<script type="application/json" id="recipe-data">${scriptJson(recipes)}</script>`,
    `<div id="root"></div>`,
    `<script type="module" id="app-js">${js}</script>`,
  ].join("\n");
}

/** The full document a self-save publishes: the host's wrapper, a line break each side of the content. */
export function renderDocument(parts) {
  return SKELETON_START + "\n" + renderContent(parts) + "\n" + SKELETON_END;
}
