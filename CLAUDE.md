# Brian's Cookbook

Personal recipe site. Browse and search recipes, scale servings, tick off
ingredients, and cook step by step. Built on the **NYLA design system**
(use the `nyla-design` skill; its hard rules apply).

## Run, build, publish

```
npm install
npm run dev             # local dev server (read-only: no owner tools outside Claude)
npm run build           # dist/ — static site, deploys to Vercel as-is (Vite preset)
npm run build:artifact  # dist-artifact/index.html — the live Claude page
```

`dist/index.html` has all JS and CSS inlined; photos are files in `dist/photos/`.

### The live page saves itself
The live copy is a Claude artifact. Brian adds, edits and deletes recipes **on the site**
(owner only: the page checks `user.isOwner()`). Saving republishes the whole page through the
`artifact` capability with the new recipe list baked in, so every viewer, signed in or not,
sees it. Photos upload to the artifact's photo storage (`assets`) and are stored as
`"/_blob/<id>"`. Everyone else gets a read-only page with no form.

- Recipes live in the page as `<script type="application/json" id="recipe-data">`, not in the JS bundle.
- `src/lib/pageTemplate.js` is the single template for both the Claude publish and the page's
  self-save. Change the head (title, fonts) there, never in two places.
- **Fill with Claude** (add form): pasted text, a photo/screenshot, or a PDF goes to Claude via the
  `sample` capability and fills the form. PDFs are read in the page with pdf.js 3.11.174 from cdnjs
  (no worker file). Filled fields show an AI-filled tag (purple = AI only) until edited.
- New recipes get `addedAt`; recipes added in the last 21 days show a **New** tag.
- Built-in photos are uploaded artifact assets; `scripts/photo-assets.json` maps file → asset id.

### Republishing from code (read this first)
The live page may hold recipes Brian added on the site that `recipes.json` doesn't have.
**Pull them before you republish**, or the publish drops them:

1. Read the live page: Artifact `read` with path `index.html`, save it.
2. `node scripts/pull-live.mjs <saved index.html>` — updates `src/data/recipes.json`.
3. `npm run build:artifact`, then publish `dist-artifact/index.html` to the same artifact URL
   (omit `capabilities` to keep `artifact`, `assets`, `user`, `sample` with images).

A new photo added in code goes in `public/photos/`, then upload it as an artifact asset and add
its id to `scripts/photo-assets.json` (the build stops if one is missing).

## Adding a recipe

On the live site: **Add recipe** in the top bar (owner only). In code: add an object to
**`src/data/recipes.json`**:

```json
{
  "id": 50,
  "slug": "chicken-tinga-tacos",
  "title": "Chicken Tinga Tacos",
  "cuisine": "Mexican",
  "tags": ["chicken", "tacos", "weeknight"],
  "prepTime": "15 min",
  "cookTime": "25 min",
  "servings": 4,
  "photo": "photos/chicken-tinga-tacos.webp",
  "ingredients": ["1.5 lb chicken thighs", "..."],
  "steps": ["...", "..."],
  "notes": "Optional tips."
}
```

- `id`: next number up. The list sorts newest (highest id) first.
- `slug`: lowercase words with hyphens. It becomes the recipe's link (`#chicken-tinga-tacos`).
  Must be unique and must not start with `cook-`.
- `photo`: optional. Put the image in `public/photos/`, ideally WebP, max 1400px on the long side.
  `photoPosition` (e.g. `"50% 0%"`) moves the crop.
- New cuisines appear in the filter automatically.
- Times like `"1 hr 15 min"`, `"45 min"` or `"2 hr"` are parsed for totals and the Quickest sort.
- Ingredient amounts at the start of a line (`2`, `1/2`, `1½`, `8–10`) rescale with servings.

## Code map

| Path | What |
|---|---|
| `src/data/recipes.json` | All recipe content |
| `src/lib/recipes.js` | Scaling, time parsing, favourites/sort storage |
| `src/App.jsx` | Hash routing (`#slug`, `#cook-slug`) and shared session state |
| `src/components/Browse.jsx` | Search, cuisine filter, favourites, sort, recipe grid |
| `src/components/RecipePage.jsx` | Recipe hero, servings stepper, ingredient checklist, method |
| `src/components/CookMode.jsx` | Full-screen steps, progress, ingredients dialog, screen wake lock |
| `src/components/RecipeForm.jsx` | Owner-only add / edit / delete form |
| `src/lib/importRecipe.js` | Read a recipe from text, photo or PDF with Claude; validate the answer |
| `src/lib/save.js` | Owner check, photo shrink + upload, self-save, error copy |
| `src/lib/pageTemplate.js` | The live page's document template (shared by build and self-save) |
| `src/components/RadioPills.jsx` | Accessible pick-one pill group (radiogroup, arrow keys) |
| `src/styles/tokens.css` | `--dl-*` tokens, generated from NYLA `tokens.json` |
| `src/styles/app.css` | All page styles, tokens only |

## Design notes

- Light only: NYLA has no dark theme yet.
- Purple only on the Fill with Claude panel, its AI callout and AI-filled tags (NYLA: purple = AI only).
- Favourite heart uses blue when on (selection), not red (red = risk).
- Cuisine is a neutral label, not a colour: NYLA colours mean status.
- Provenance tags and advisor/client views don't apply to a cookbook.
- Errors and the delete confirm use NYLA red (`--dl-red*`); placeholders start with "e.g.".
- `--dl-scrim` (dialog backdrop) is **Proposed**: add it to NYLA `tokens.json` or replace it.
- Favourites and sort are saved per browser (localStorage), not shared.
