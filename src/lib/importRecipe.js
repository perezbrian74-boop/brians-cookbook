// Fill the recipe form from something Brian already has: pasted text, a photo or
// screenshot of a recipe, or a PDF. Claude (the `sample` capability) does the reading.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const MAX_TEXT = 40000; // characters sent to Claude; recipes are far shorter

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject({ code: "pdf_unavailable" });
    document.head.appendChild(s);
  });
}

/** Text from the first pages of a PDF. pdf.js runs on the page's own thread (no worker file). */
export async function pdfText(file, maxPages = 12) {
  await loadScript(PDFJS + "pdf.worker.min.js"); // defines window.pdfjsWorker → in-page "fake" worker
  await loadScript(PDFJS + "pdf.min.js");
  const lib = window.pdfjsLib;
  if (!lib) throw { code: "pdf_unavailable" };
  lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, maxPages) && out.length < MAX_TEXT; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n\n";
  }
  await doc.destroy();
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Shrink a recipe photo or screenshot for Claude to read (long side ≤ 1600px, JPEG). */
async function readableImage(file, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close?.();
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
}

function prompt(source, cuisines) {
  return `You turn a recipe into structured data for a personal cookbook.

Read the recipe ${source}. Return ONLY a JSON object with these keys:
{
  "title": string,            // the dish name, Title Case, no site name
  "cuisine": string,          // one word or two, e.g. "Mexican". Prefer one of: ${cuisines.join(", ") || "none yet"}. "" if unclear
  "tags": string[],           // 2-5 short lowercase tags: main ingredient, dish type, occasion
  "prepTime": string,         // like "15 min" or "1 hr 10 min". "" if not stated
  "cookTime": string,         // same format. "" if not stated
  "servings": number | null,  // how many it serves or makes; null if not stated
  "ingredients": string[],    // one per item, amount first ("2 cups flour", "1/2 tsp salt"), units as written
  "steps": string[],          // one per step, plain sentences, no numbering
  "notes": string             // tips, swaps or make-ahead notes from the recipe; "" if none
}

Rules: copy amounts, times and temperatures exactly; never invent an ingredient, amount or step.
Leave a field empty rather than guess. Skip ads, life stories, comments, nutrition and ratings.
If there is no recipe at all, return {"error": "no recipe found"}.`;
}

const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v, max) => (Array.isArray(v) ? v.map((x) => str(x, 600)).filter(Boolean).slice(0, max) : []);

/** Validate Claude's answer into form values. Returns { values, filled: string[] }. */
export function toFormValues(out) {
  if (!out || typeof out !== "object" || out.error) throw { code: "no_recipe" };
  const values = {
    title: str(out.title, 120),
    cuisine: str(out.cuisine, 40),
    tags: list(out.tags, 6).map((t) => t.toLowerCase()).join(", "),
    prepTime: str(out.prepTime, 30),
    cookTime: str(out.cookTime, 30),
    servings: Number.isInteger(out.servings) && out.servings > 0 && out.servings <= 50 ? String(out.servings) : "",
    ingredients: list(out.ingredients, 80).join("\n"),
    steps: list(out.steps, 60).map((s) => s.replace(/^\s*(step\s*)?\d+[.):]\s*/i, "")).join("\n"),
    notes: str(out.notes, 1500),
  };
  if (!values.title && !values.ingredients && !values.steps) throw { code: "no_recipe" };
  const filled = Object.keys(values).filter((k) => values[k]);
  return { values, filled };
}

/**
 * Read a recipe with Claude. `text` and/or `file` (image or PDF).
 * Rejects with {code} — see importMessage().
 */
export async function extractRecipe(sample, { text, file, cuisines, imagesAllowed, signal }) {
  let body = (text || "").trim();
  const images = [];
  if (file) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const t = await pdfText(file);
      if (!t) throw { code: "pdf_empty" };
      body = (body ? body + "\n\n" : "") + t;
    } else if (file.type.startsWith("image/")) {
      if (!imagesAllowed) throw { code: "images_unavailable" };
      images.push(await readableImage(file));
    } else {
      throw { code: "unsupported_file" };
    }
  }
  if (!body && !images.length) throw { code: "nothing" };
  const source = images.length
    ? `in the attached photo${body ? " and the text below" : ""}`
    : "text below (copied from a web page or document, so expect clutter)";
  const input = prompt(source, cuisines) + (body ? `\n\n<recipe_text>\n${body.slice(0, MAX_TEXT)}\n</recipe_text>` : "");
  const out = await sample.json(input, { images: images.length ? images : undefined, modelTier: "default", cache: false, signal });
  return toFormValues(out);
}

export function importMessage(err) {
  switch (err?.code) {
    case "nothing": return "Paste the recipe or attach a photo or PDF first.";
    case "no_recipe": return "Couldn't find a recipe in that. Try copying just the recipe part of the page.";
    case "pdf_empty": return "That PDF has no readable text (it may be a scan). Take a screenshot of it and attach that instead.";
    case "pdf_unavailable": return "Couldn't open the PDF reader. Copy the recipe text from the PDF and paste it instead.";
    case "unsupported_file": return "Attach a photo, screenshot or PDF.";
    case "images_unavailable":
    case "image_rejected": return "Photos can't be read in this view. Paste the recipe text instead.";
    case "prompt_too_large": return "That's too long to read at once. Paste just the recipe part.";
    case "not_granted": return "Claude isn't allowed on this page yet. Allow it when asked, or fill the form by hand.";
    case "rate_limited":
    case "queue_overflow": return "Claude is busy or you've hit a usage limit. Try again in a bit.";
    case "invalid_json":
    case "empty_completion": return "The answer came back garbled. Try again.";
    case "refused": return "Claude wouldn't read that one. Try pasting the recipe text.";
    case "cancelled": return null;
    default: return "Couldn't read the recipe just now. Try again, or fill the form by hand.";
  }
}
