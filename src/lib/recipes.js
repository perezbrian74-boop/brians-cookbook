// Recipe helpers: data, slugs, quantity scaling, time parsing, per-viewer storage.

/** Recipes ship as JSON in the page (<script id="recipe-data">), see vite.config.js. */
export function readRecipes() {
  try { return JSON.parse(document.getElementById("recipe-data")?.textContent || "[]"); }
  catch { return []; }
}

export const cuisinesOf = (list) => [...new Set(list.map((r) => r.cuisine).filter(Boolean))].sort();

// Hash names the page or claude.ai already uses; a recipe slug must not collide.
const RESERVED = /^(add|edit-.*|cook-.*|settings|sidebar|customize|upgrade|downloads|comment-.*)$/;

export function slugify(title, taken) {
  let base = (title || "recipe")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recipe";
  if (RESERVED.test(base)) base = "recipe-" + base;
  let s = base;
  for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
  return s;
}

/** Added through the site in the last 21 days → shows a "New" tag. */
const NEW_DAYS = 21;
export function isNew(r, now = Date.now()) {
  const t = r.addedAt ? Date.parse(r.addedAt) : NaN;
  return Number.isFinite(t) && now - t < NEW_DAYS * 864e5;
}
export function fmtAdded(r) {
  const t = r.addedAt ? new Date(r.addedAt) : null;
  if (!t || isNaN(t)) return null;
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: t.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

// ── Quantity scaling ─────────────────────────────────────────────
const UF = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
};
const NUM = "(?:\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?\\s*[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]?|[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])";
const LEAD = new RegExp("^\\s*(" + NUM + ")(\\s*[–-]\\s*(" + NUM + "))?");

function parseNum(t) {
  if (!t) return NaN;
  t = t.trim();
  if (/^\d+\s*\/\s*\d+$/.test(t)) {
    const [a, b] = t.split("/");
    return parseInt(a, 10) / parseInt(b, 10);
  }
  let total = 0;
  let rest = t;
  const m = t.match(/^\d+(?:\.\d+)?/);
  if (m) { total += parseFloat(m[0]); rest = t.slice(m[0].length).trim(); }
  if (rest && UF[rest] != null) total += UF[rest];
  return total;
}

export function niceQty(n) {
  if (!isFinite(n) || n <= 0) return "0";
  if (n >= 20) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (Math.abs(frac - 1 / 3) < 0.045) return (whole > 0 ? whole : "") + "⅓";
  if (Math.abs(frac - 2 / 3) < 0.045) return (whole > 0 ? whole : "") + "⅔";
  const e = Math.round(frac * 8);
  const map = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞", ""];
  const w = whole + (e === 8 ? 1 : 0);
  const f = map[e];
  if (w === 0 && f === "") return "0";
  return (w > 0 ? String(w) : "") + f;
}

/** Scale the leading quantity of an ingredient line; leave the rest alone. */
export function scaleIngredient(line, ratio) {
  if (!line || ratio === 1) return line;
  const m = line.match(LEAD);
  if (!m) return line;
  const a = parseNum(m[1]);
  if (!isFinite(a) || a <= 0) return line;
  let repl = niceQty(a * ratio);
  if (m[3]) {
    const b = parseNum(m[3]);
    if (isFinite(b)) repl += "–" + niceQty(b * ratio);
  }
  return repl + line.slice(m[0].length);
}

// ── Time ─────────────────────────────────────────────────────────
export function parseMinutes(s) {
  if (!s) return 0;
  s = String(s).toLowerCase();
  let total = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/);
  if (h) total += parseFloat(h[1]) * 60;
  const m = s.match(/(\d+)\s*min/);
  if (m) total += parseInt(m[1], 10);
  if (!h && !m) {
    const n = s.match(/(\d+)/);
    if (n) total += parseInt(n[1], 10);
  }
  return total;
}

export const totalMinutes = (r) => parseMinutes(r.prepTime) + parseMinutes(r.cookTime);

export function fmtMinutes(min) {
  if (!min) return "—";
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// ── Per-viewer storage (favourites, sort). Never required to render. ──
const FAV_KEY = "cookbook.favs.v2";
export function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
  catch { return new Set(); }
}
export function saveFavs(set) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); } catch { /* storage blocked */ }
}
export function loadPref(key, fallback) {
  try { return localStorage.getItem("cookbook.pref." + key) ?? fallback; }
  catch { return fallback; }
}
export function savePref(key, val) {
  try { localStorage.setItem("cookbook.pref." + key, val); } catch { /* storage blocked */ }
}
