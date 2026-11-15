import React from "react";
import { ChevronLeft, ListChecks, X } from "lucide-react";
import { scaleIngredient } from "../lib/recipes.js";
import { Checklist } from "./RecipePage.jsx";

export default function CookMode({ recipe: r, servings, checked, onToggleCheck }) {
  const steps = r.steps || [];
  const last = steps.length - 1;
  const [step, setStep] = React.useState(0);
  const dialogRef = React.useRef(null);
  const stepRef = React.useRef(null);
  const base = r.servings || servings;
  const lines = (r.ingredients || []).map((l) => scaleIngredient(l, base ? servings / base : 1));
  const atEnd = step >= last;
  const recipeHref = "#" + r.slug;

  const go = React.useCallback((n) => setStep(Math.max(0, Math.min(last, n))), [last]);

  // Arrow keys move between steps (ignored while the ingredients dialog is open).
  React.useEffect(() => {
    function onKey(e) {
      if (dialogRef.current?.open) return;
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, go]);

  // Keep the screen awake while cooking, where the browser allows it.
  React.useEffect(() => {
    let lock = null;
    let gone = false;
    async function request() {
      try {
        if (document.visibilityState === "visible" && navigator.wakeLock) lock = await navigator.wakeLock.request("screen");
        if (gone) lock?.release();
      } catch { /* not allowed here; fine */ }
    }
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => { gone = true; document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, []);

  // Move focus to the new step so screen readers announce it.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    stepRef.current?.focus({ preventScroll: true });
  }, [step]);

  const pct = steps.length ? ((step + 1) / steps.length) * 100 : 0;

  return (
    <div className="cb-cook">
      <header className="cb-cook__top">
        <a className="cb-back" href={recipeHref}><ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />Exit</a>
        <p className="cb-cook__name">{r.title}</p>
        <button type="button" className="cb-btn cb-btn--secondary cb-btn--sm" onClick={() => dialogRef.current?.showModal()}>
          <ListChecks aria-hidden="true" size={16} strokeWidth={2} />
          Ingredients
        </button>
      </header>

      <div className="cb-progress" role="progressbar" aria-label="Recipe progress"
        aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${steps.length}`}>
        <div className="cb-progress__fill" style={{ width: pct + "%" }} />
      </div>

      <main className="cb-cook__stage">
        <div className="cb-cook__card">
          <p className="cb-label">Step {step + 1} of {steps.length}</p>
          <p className="cb-cook__text" tabIndex={-1} ref={stepRef} aria-live="polite">{steps[step]}</p>
          {!atEnd && (
            <div className="cb-cook__next">
              <span className="cb-label">Up next</span>
              <p className="cb-body">{steps[step + 1]}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="cb-cook__foot">
        <button type="button" className="cb-btn cb-btn--secondary" disabled={step === 0} onClick={() => go(step - 1)}>
          ‹ Back
        </button>
        <nav className="cb-dots" aria-label="Steps">
          {steps.map((_, i) => (
            <button key={i} type="button"
              className={"cb-dot" + (i === step ? " is-on" : i < step ? " is-done" : "")}
              aria-label={`Step ${i + 1}`} aria-current={i === step ? "step" : undefined}
              onClick={() => go(i)} />
          ))}
        </nav>
        {atEnd
          ? <a className="cb-btn" href={recipeHref}>Finish ›</a>
          : <button type="button" className="cb-btn" onClick={() => go(step + 1)}>Next step ›</button>}
      </footer>

      <dialog ref={dialogRef} className="cb-sheet" aria-labelledby="sheet-h"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="cb-sheet__panel">
          <div className="cb-card__head">
            <div>
              <h2 className="cb-title" id="sheet-h">Ingredients</h2>
              <p className="cb-caption">For {servings} {servings === 1 ? "serving" : "servings"} · {checked.size} of {lines.length} gathered</p>
            </div>
            <button type="button" className="cb-icon-btn" onClick={() => dialogRef.current?.close()} aria-label="Close ingredients">
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          </div>
          <Checklist lines={lines} checked={checked} onToggle={onToggleCheck} idPrefix="sheet" />
        </div>
      </dialog>
    </div>
  );
}
