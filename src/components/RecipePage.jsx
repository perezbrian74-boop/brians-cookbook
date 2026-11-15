import React from "react";
import { ChevronLeft, Minus, Plus, Info, Pencil } from "lucide-react";
import { scaleIngredient, parseMinutes, totalMinutes, fmtMinutes, isNew, fmtAdded } from "../lib/recipes.js";
import { Photo, FavButton } from "./shared.jsx";

export function Stepper({ value, min = 1, max = 50, onChange, unit }) {
  return (
    <div className="cb-stepper" role="group" aria-label="Servings">
      <button type="button" className="cb-stepper__btn" disabled={value <= min}
        onClick={() => onChange((v) => Math.max(min, v - 1))} aria-label="Fewer servings">
        <Minus aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      <output className="cb-stepper__val cb-num" aria-live="polite">
        {value} <span className="cb-stepper__unit">{unit}</span>
      </output>
      <button type="button" className="cb-stepper__btn" disabled={value >= max}
        onClick={() => onChange((v) => Math.min(max, v + 1))} aria-label="More servings">
        <Plus aria-hidden="true" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

export function Checklist({ lines, checked, onToggle, idPrefix }) {
  return (
    <ul className="cb-checklist" role="list">
      {lines.map((line, i) => (
        <li key={i}>
          <label className={"cb-check" + (checked.has(i) ? " is-on" : "")}>
            <input id={`${idPrefix}-${i}`} type="checkbox" checked={checked.has(i)} onChange={() => onToggle(i)} />
            <span className="cb-check__text">{line}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export default function RecipePage({ recipe: r, servings, setServings, checked, onToggleCheck, isFav, onToggleFav, isOwner }) {
  const base = r.servings || servings;
  const ratio = base ? servings / base : 1;
  const lines = (r.ingredients || []).map((l) => scaleIngredient(l, ratio));
  const steps = r.steps || [];
  const prep = parseMinutes(r.prepTime);
  const cook = parseMinutes(r.cookTime);

  return (
    <div className="cb-page">
      <header className="cb-top">
        <div className="cb-wrap cb-top__inner">
          <a className="cb-back" href="#"><ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />All recipes</a>
          <div className="cb-top__group">
            {isOwner && (
              <a className="cb-btn cb-btn--secondary cb-btn--sm" href={"#edit-" + r.slug}>
                <Pencil aria-hidden="true" size={15} strokeWidth={2} />Edit
              </a>
            )}
            <FavButton active={isFav} onClick={onToggleFav} title={r.title} />
          </div>
        </div>
      </header>

      <main className="cb-wrap cb-main cb-recipe-page">
        <section className="cb-hero">
          <figure className="cb-hero__figure">
            <Photo recipe={r} className="cb-hero__photo" eager />
            {r.photo && r.photoCredit && <figcaption className="cb-caption">Photo: {r.photoCredit}</figcaption>}
          </figure>
          <div className="cb-hero__body">
            <div className="cb-recipe__kicker">
              <span className="cb-label">{r.cuisine}</span>
              {isNew(r) && <span className="cb-tag cb-tag--new">New</span>}
              {fmtAdded(r) && <span className="cb-caption">Added {fmtAdded(r)}</span>}
            </div>
            <h1 className="cb-display">{r.title}</h1>
            {r.tags?.length > 0 && (
              <ul className="cb-tags" role="list" aria-label="Tags">
                {r.tags.map((t) => <li key={t} className="cb-tag">{t}</li>)}
              </ul>
            )}

            <dl className="cb-stats">
              <div className="cb-stat"><dt className="cb-label">Prep</dt><dd className="cb-stat__val cb-num">{fmtMinutes(prep)}</dd></div>
              <div className="cb-stat"><dt className="cb-label">Cook</dt><dd className="cb-stat__val cb-num">{fmtMinutes(cook)}</dd></div>
              <div className="cb-stat"><dt className="cb-label">Total</dt><dd className="cb-stat__val cb-num">{fmtMinutes(totalMinutes(r))}</dd></div>
            </dl>

            <div className="cb-hero__actions">
              <a className="cb-btn" href={"#cook-" + r.slug}>Start cooking ›</a>
              <span className="cb-caption">{lines.length} ingredients · {steps.length} steps</span>
            </div>
          </div>
        </section>

        <div className="cb-columns">
          <section className="cb-card" aria-labelledby="ing-h">
            <div className="cb-card__head">
              <h2 className="cb-title" id="ing-h">Ingredients</h2>
              <span className="cb-caption cb-num">{checked.size} of {lines.length} gathered</span>
            </div>
            <div className="cb-scaler">
              <div>
                <div className="cb-scaler__title">Servings</div>
                {servings !== base ? (
                  <button type="button" className="cb-link" onClick={() => setServings(base)}>
                    Scaled from {base} · reset
                  </button>
                ) : (
                  <div className="cb-caption">Amounts rescale as you change this</div>
                )}
              </div>
              <Stepper value={servings} onChange={setServings} unit={servings === 1 ? "serving" : "servings"} />
            </div>
            <Checklist lines={lines} checked={checked} onToggle={onToggleCheck} idPrefix="ing" />
          </section>

          <div className="cb-stack">
            <section className="cb-card" aria-labelledby="steps-h">
              <div className="cb-card__head">
                <h2 className="cb-title" id="steps-h">Method</h2>
                <span className="cb-caption">{steps.length} steps</span>
              </div>
              <ol className="cb-steps">
                {steps.map((s, i) => (
                  <li key={i}>
                    <span className="cb-steps__num cb-num" aria-hidden="true">{i + 1}</span>
                    <p className="cb-steps__text">{s}</p>
                  </li>
                ))}
              </ol>
            </section>

            {r.notes && (
              <aside className="cb-callout" aria-label="Cook's notes">
                <Info aria-hidden="true" size={18} strokeWidth={2} className="cb-callout__icon" />
                <div>
                  <h2 className="cb-title">Cook's notes</h2>
                  <p className="cb-body">{r.notes}</p>
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
