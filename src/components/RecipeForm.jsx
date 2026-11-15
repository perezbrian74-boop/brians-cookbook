import React from "react";
import { ChevronLeft, ImagePlus, Trash2, TriangleAlert, Paperclip, X } from "lucide-react";
import { cuisinesOf, slugify } from "../lib/recipes.js";
import { uploadPhoto, messageFor } from "../lib/save.js";
import { extractRecipe, importMessage } from "../lib/importRecipe.js";

const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function toValues(r) {
  return {
    title: r?.title ?? "",
    cuisine: r?.cuisine ?? "",
    tags: (r?.tags ?? []).join(", "),
    prepTime: r?.prepTime ?? "",
    cookTime: r?.cookTime ?? "",
    servings: r?.servings ? String(r.servings) : "4",
    photo: r?.photo ?? "",
    photoPosition: r?.photoPosition,
    ingredients: (r?.ingredients ?? []).join("\n"),
    steps: (r?.steps ?? []).join("\n"),
    notes: r?.notes ?? "",
  };
}

function validate(v) {
  const e = {};
  if (!v.title.trim()) e.title = "Give the recipe a name.";
  if (!lines(v.ingredients).length) e.ingredients = "Add at least one ingredient, one per line.";
  if (!lines(v.steps).length) e.steps = "Add at least one step, one per line.";
  const n = Number(v.servings);
  if (v.servings && (!Number.isInteger(n) || n < 1 || n > 50)) e.servings = "Use a whole number from 1 to 50.";
  return e;
}

function Field({ id, label, hint, error, ai, children }) {
  return (
    <div className={"cb-field" + (error ? " is-invalid" : "")}>
      <div className="cb-field__top">
        <label className="cb-field__label" htmlFor={id}>{label}</label>
        {ai && <span className="cb-tag cb-tag--ai">AI-filled</span>}
      </div>
      {children}
      {error ? <p className="cb-field__error" id={id + "-msg"}>{error}</p>
        : hint ? <p className="cb-caption" id={id + "-msg"}>{hint}</p> : null}
    </div>
  );
}

/** Paste text or attach a photo/PDF; Claude fills the form. AI-only purple lives here. */
function ImportPanel({ tools, cuisines, onFill }) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const ctrl = React.useRef(null);
  const accept = tools.imagesAllowed ? "image/*,application/pdf,.pdf" : "application/pdf,.pdf";

  async function fill() {
    setError(null);
    setDone(false);
    setBusy(true);
    ctrl.current = new AbortController();
    try {
      const res = await extractRecipe(tools.sample, {
        text, file, cuisines, imagesAllowed: tools.imagesAllowed, signal: ctrl.current.signal,
      });
      onFill(res);
      setDone(true);
    } catch (err) {
      setError(importMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cb-card cb-import" aria-labelledby="imp-h">
      <div className="cb-import__head">
        <p className="cb-eyebrow"><span aria-hidden="true">✦ </span>Fill with Claude</p>
        <h2 className="cb-title" id="imp-h">Start from a recipe you already have</h2>
        <p className="cb-body">
          On a recipe website or doc, select all, copy, and paste it here
          {tools.imagesAllowed ? ", or attach a photo, screenshot or PDF" : ", or attach a PDF"}.
          Claude fills in the form below for you to check before saving.
        </p>
      </div>
      <label className="cb-sr" htmlFor="import-text">Recipe to read</label>
      <textarea id="import-text" className="cb-textarea" rows={5} value={text} disabled={busy}
        onChange={(e) => setText(e.target.value)} placeholder="Paste the recipe here" />
      <div className="cb-import__row">
        {file ? (
          <span className="cb-file-chip">
            <Paperclip aria-hidden="true" size={14} strokeWidth={2} />
            <span className="cb-file-chip__name">{file.name}</span>
            <button type="button" className="cb-file-chip__x" onClick={() => setFile(null)} disabled={busy} aria-label={"Remove " + file.name}>
              <X aria-hidden="true" size={14} strokeWidth={2} />
            </button>
          </span>
        ) : (
          <label className="cb-btn cb-btn--secondary cb-btn--sm cb-file">
            <Paperclip aria-hidden="true" size={16} strokeWidth={2} />
            {tools.imagesAllowed ? "Attach photo or PDF" : "Attach PDF"}
            <input id="import-file" type="file" accept={accept} disabled={busy}
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ""; }} />
          </label>
        )}
        <button type="button" className="cb-btn cb-btn--secondary cb-btn--sm" onClick={fill} disabled={busy || (!text.trim() && !file)}>
          <span className="cb-spark" aria-hidden="true">✦</span>Fill the form
        </button>
      </div>
      {busy && (
        <div className="cb-ai-status" role="status">
          <span className="cb-spark" aria-hidden="true">✦</span>
          <span>Claude is reading your recipe…</span>
          <button type="button" className="cb-link" onClick={() => ctrl.current?.abort()}>Stop</button>
        </div>
      )}
      {done && !busy && (
        <div className="cb-callout cb-callout--ai" role="status">
          <span className="cb-spark cb-callout__icon" aria-hidden="true">✦</span>
          <div><p className="cb-body">Filled in from your recipe. Fields marked AI-filled came from Claude, so check amounts and steps, then save.</p></div>
        </div>
      )}
      {error && (
        <div className="cb-callout cb-callout--error" role="alert">
          <TriangleAlert aria-hidden="true" size={18} strokeWidth={2} className="cb-callout__icon" />
          <div><p className="cb-body">{error}</p></div>
        </div>
      )}
    </section>
  );
}

/**
 * Add or edit a recipe. Owner only. `onSave(nextList, landHash, draft)` republishes the page.
 * `draft` (from a failed or interrupted save) restores what was typed.
 */
export default function RecipeForm({ recipe, recipes, tools, route, draft, onSave, onDiscardDraft }) {
  const editing = !!recipe;
  const restored = draft?.route === route ? draft : null;
  const [v, setV] = React.useState(() => restored?.values ?? toValues(recipe));
  const [file, setFile] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState(restored?.error ?? null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [aiFields, setAiFields] = React.useState(() => new Set());
  const formRef = React.useRef(null);
  const cuisines = cuisinesOf(recipes);
  const backHref = editing ? "#" + recipe.slug : "#";

  React.useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (key) => (e) => {
    setV((s) => ({ ...s, [key]: e.target.value }));
    if (aiFields.has(key)) setAiFields((a) => { const n = new Set(a); n.delete(key); return n; });
  };
  function fillFromImport({ values, filled }) {
    setV((s) => {
      const n = { ...s };
      for (const k of filled) n[k] = values[k];
      return n;
    });
    setAiFields(new Set(filled));
    setErrors({});
  }
  const HAS_HINT = ["cuisine", "tags", "ingredients", "notes"];
  const aria = (key) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] || HAS_HINT.includes(key) ? key + "-msg" : undefined,
  });

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setStatus(null);
      requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid='true']")?.focus());
      return;
    }
    setSaving(true);
    setStatus({ tone: "info", text: file ? "Uploading your photo…" : "Saving…" });

    let photo = v.photo;
    if (file) {
      if (!tools.assets) {
        setSaving(false);
        setStatus({ tone: "error", text: "Photo uploads aren't available in this view. Remove the photo or open the cookbook from claude.ai." });
        return;
      }
      try {
        photo = await uploadPhoto(tools.assets, file);
      } catch (err) {
        setSaving(false);
        setStatus({ tone: "error", text: messageFor(err) });
        return;
      }
      setV((s) => ({ ...s, photo }));
      setFile(null);
      setStatus({ tone: "info", text: "Saving…" });
    }

    const others = recipes.filter((r) => r.id !== recipe?.id);
    const slug = editing ? recipe.slug : slugify(v.title, new Set(others.map((r) => r.slug)));
    const next = {
      id: editing ? recipe.id : Math.max(0, ...recipes.map((r) => r.id)) + 1,
      slug,
      title: v.title.trim(),
      cuisine: v.cuisine.trim() || "Other",
      tags: v.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      prepTime: v.prepTime.trim(),
      cookTime: v.cookTime.trim(),
      servings: Number(v.servings) || 4,
      photo: photo || undefined,
      photoPosition: photo === recipe?.photo ? recipe?.photoPosition : undefined,
      ingredients: lines(v.ingredients),
      steps: lines(v.steps),
      notes: v.notes.trim() || undefined,
      addedAt: editing ? recipe.addedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = editing ? recipes.map((r) => (r.id === recipe.id ? next : r)) : [next, ...recipes];
    const err = await onSave(list, "#" + slug, { route, values: { ...v, photo }, savedStamp: next.updatedAt });
    if (err) { setSaving(false); setStatus({ tone: "error", text: err }); }
  }

  async function remove() {
    setSaving(true);
    setStatus({ tone: "info", text: "Deleting…" });
    const err = await onSave(recipes.filter((r) => r.id !== recipe.id), "#", { route, values: v, deletedId: recipe.id });
    if (err) { setSaving(false); setConfirmDelete(false); setStatus({ tone: "error", text: err }); }
  }

  const shownPhoto = preview || v.photo;

  return (
    <div className="cb-page">
      <header className="cb-top">
        <div className="cb-wrap cb-top__inner">
          <a className="cb-back" href={backHref}><ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />
            {editing ? "Back to recipe" : "All recipes"}</a>
        </div>
      </header>

      <main className="cb-wrap cb-main cb-form-page">
        <div className="cb-intro">
          <span className="cb-label">{editing ? "Edit recipe" : "New recipe"}</span>
          <h1 className="cb-display">{editing ? recipe.title : "Add a recipe"}</h1>
          <p className="cb-lead">
            {editing ? "Changes go live for everyone as soon as you save." : "It goes live for everyone as soon as you save. Only you can see this form."}
          </p>
        </div>

        {restored && !restored.error && (
          <div className="cb-callout" role="status">
            <div><p className="cb-body">Restored what you were typing before the page reloaded.</p></div>
            <button type="button" className="cb-link" onClick={() => { onDiscardDraft(); setV(toValues(recipe)); }}>Start over</button>
          </div>
        )}

        {!editing && tools.sample && (
          <ImportPanel tools={tools} cuisines={cuisines} onFill={fillFromImport} />
        )}

        <form ref={formRef} className="cb-form" onSubmit={submit} noValidate>
          <section className="cb-card" aria-labelledby="f-basics">
            <h2 className="cb-title" id="f-basics">The basics</h2>

            <div className="cb-photo-field">
              <div className="cb-photo-field__tile">
                {shownPhoto
                  ? <img src={shownPhoto} alt="" />
                  : <span className="cb-caption">No photo</span>}
              </div>
              <div className="cb-photo-field__actions">
                <label className="cb-btn cb-btn--secondary cb-btn--sm cb-file">
                  <ImagePlus aria-hidden="true" size={16} strokeWidth={2} />
                  {shownPhoto ? "Change photo" : "Add photo"}
                  <input id="photo" type="file" accept="image/*" disabled={saving}
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
                </label>
                {shownPhoto && (
                  <button type="button" className="cb-link" disabled={saving}
                    onClick={() => { setFile(null); setV((s) => ({ ...s, photo: "" })); }}>Remove photo</button>
                )}
                <p className="cb-caption">Shrunk on your device before upload.</p>
              </div>
            </div>

            <Field ai={aiFields.has("title")} id="title" label="Name" error={errors.title}>
              <input id="title" className="cb-input" value={v.title} onChange={set("title")} placeholder="e.g. Chicken tinga tacos" autoComplete="off" {...aria("title")} />
            </Field>
            <div className="cb-field-row">
              <Field ai={aiFields.has("cuisine")} id="cuisine" label="Cuisine" hint="Pick one or type a new one">
                <input id="cuisine" className="cb-input" list="cuisine-list" value={v.cuisine} onChange={set("cuisine")} placeholder="e.g. Mexican" autoComplete="off" {...aria("cuisine")} />
                <datalist id="cuisine-list">{cuisines.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field ai={aiFields.has("tags")} id="tags" label="Tags" hint="Separate with commas">
                <input id="tags" className="cb-input" value={v.tags} onChange={set("tags")} placeholder="e.g. chicken, tacos, weeknight" autoComplete="off" {...aria("tags")} />
              </Field>
            </div>
            <div className="cb-field-row cb-field-row--3">
              <Field ai={aiFields.has("prepTime")} id="prepTime" label="Prep time">
                <input id="prepTime" className="cb-input" value={v.prepTime} onChange={set("prepTime")} placeholder="e.g. 15 min" autoComplete="off" {...aria("prepTime")} />
              </Field>
              <Field ai={aiFields.has("cookTime")} id="cookTime" label="Cook time">
                <input id="cookTime" className="cb-input" value={v.cookTime} onChange={set("cookTime")} placeholder="e.g. 1 hr 10 min" autoComplete="off" {...aria("cookTime")} />
              </Field>
              <Field ai={aiFields.has("servings")} id="servings" label="Serves" error={errors.servings}>
                <input id="servings" className="cb-input" type="number" inputMode="numeric" min="1" max="50" value={v.servings} onChange={set("servings")} {...aria("servings")} />
              </Field>
            </div>
          </section>

          <section className="cb-card" aria-labelledby="f-ing">
            <h2 className="cb-title" id="f-ing">Ingredients</h2>
            <Field ai={aiFields.has("ingredients")} id="ingredients" label="One per line" error={errors.ingredients}
              hint="Start with the amount (2 cups, 1/2 tsp, 1½ lb) so it rescales with servings">
              <textarea id="ingredients" className="cb-textarea" rows={9} value={v.ingredients} onChange={set("ingredients")}
                placeholder={"e.g.\n1.5 lb boneless chicken thighs\n2 chipotles in adobo, chopped\n1 white onion, sliced"} {...aria("ingredients")} />
            </Field>
          </section>

          <section className="cb-card" aria-labelledby="f-steps">
            <h2 className="cb-title" id="f-steps">Method</h2>
            <Field ai={aiFields.has("steps")} id="steps" label="One step per line" error={errors.steps}>
              <textarea id="steps" className="cb-textarea" rows={9} value={v.steps} onChange={set("steps")}
                placeholder={"e.g.\nSimmer the chicken in salted water until cooked through, about 20 minutes.\nShred the chicken with two forks."} {...aria("steps")} />
            </Field>
            <Field ai={aiFields.has("notes")} id="notes" label="Cook's notes" hint="Optional">
              <textarea id="notes" className="cb-textarea" rows={3} value={v.notes} onChange={set("notes")}
                placeholder="Tips, swaps, what to serve it with" {...aria("notes")} />
            </Field>
          </section>

          {status && (
            <div className={"cb-callout" + (status.tone === "error" ? " cb-callout--error" : "")}
              role={status.tone === "error" ? "alert" : "status"}>
              {status.tone === "error" && <TriangleAlert aria-hidden="true" size={18} strokeWidth={2} className="cb-callout__icon" />}
              <div><p className="cb-body">{status.text}</p></div>
            </div>
          )}

          <div className="cb-form__actions">
            <button type="submit" className="cb-btn" disabled={saving}>{saving ? "Saving…" : "Save recipe ›"}</button>
            <a className="cb-btn cb-btn--secondary" href={backHref} aria-disabled={saving || undefined}>Cancel</a>
            {editing && !confirmDelete && (
              <button type="button" className="cb-link cb-form__delete" disabled={saving} onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden="true" size={15} strokeWidth={2} />Delete recipe
              </button>
            )}
          </div>

          {editing && confirmDelete && (
            <div className="cb-callout cb-callout--error" role="alertdialog" aria-labelledby="del-h">
              <TriangleAlert aria-hidden="true" size={18} strokeWidth={2} className="cb-callout__icon" />
              <div className="cb-confirm">
                <p className="cb-title" id="del-h">Delete {recipe.title}?</p>
                <p className="cb-body">It disappears from the cookbook for everyone. You can't undo this from the page.</p>
                <div className="cb-confirm__actions">
                  <button type="button" className="cb-btn cb-btn--secondary cb-btn--sm cb-btn--danger" disabled={saving} onClick={remove} autoFocus>Delete recipe</button>
                  <button type="button" className="cb-btn cb-btn--secondary cb-btn--sm" disabled={saving} onClick={() => setConfirmDelete(false)}>Keep it</button>
                </div>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
