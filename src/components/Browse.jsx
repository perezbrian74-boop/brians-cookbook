import React from "react";
import { Search, Clock, Users, Heart, X, Plus } from "lucide-react";
import { cuisinesOf, totalMinutes, fmtMinutes, loadPref, savePref, isNew } from "../lib/recipes.js";
import { Photo, FavButton } from "./shared.jsx";
import RadioPills from "./RadioPills.jsx";

const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "name", label: "A–Z" },
  { value: "quick", label: "Quickest" },
];

export default function Browse({ recipes: RECIPES, favs, onToggleFav, isOwner }) {
  const CUISINES = cuisinesOf(RECIPES);
  const [query, setQuery] = React.useState("");
  const [cuisine, setCuisine] = React.useState("All");
  // A cuisine filter can outlive its last recipe (deleted elsewhere): fall back to All.
  React.useEffect(() => { if (cuisine !== "All" && !CUISINES.includes(cuisine)) setCuisine("All"); }, [cuisine, CUISINES.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [favOnly, setFavOnly] = React.useState(false);
  const [sort, setSort] = React.useState(() => {
    const s = loadPref("sort", "recent");
    return SORTS.some((o) => o.value === s) ? s : "recent";
  });
  React.useEffect(() => savePref("sort", sort), [sort]);

  const q = query.toLowerCase().trim();
  const list = RECIPES.filter((r) => {
    if (cuisine !== "All" && r.cuisine !== cuisine) return false;
    if (favOnly && !favs.has(r.id)) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.cuisine || "").toLowerCase().includes(q) ||
      (r.tags || []).some((t) => t.toLowerCase().includes(q)) ||
      (r.ingredients || []).some((i) => i.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (sort === "name") return a.title.localeCompare(b.title);
    if (sort === "quick") return totalMinutes(a) - totalMinutes(b);
    return b.id - a.id;
  });

  const cuisineOptions = [
    { value: "All", label: "All", count: RECIPES.length },
    ...CUISINES.map((c) => ({ value: c, label: c, count: RECIPES.filter((r) => r.cuisine === c).length })),
  ];
  const filtered = list.length !== RECIPES.length;

  function clearFilters() {
    setQuery("");
    setCuisine("All");
    setFavOnly(false);
  }

  return (
    <div className="cb-page">
      <header className="cb-top">
        <div className="cb-wrap cb-top__inner">
          <a className="cb-brand" href="#">Brian's Cookbook</a>
          <label className="cb-search">
            <Search aria-hidden="true" size={18} strokeWidth={2} />
            <span className="cb-sr">Search recipes</span>
            <input
              id="search"
              type="search"
              placeholder="Search recipes, ingredients, tags"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button type="button" className="cb-search__clear" onClick={() => setQuery("")} aria-label="Clear search">
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            )}
          </label>
          {isOwner && (
            <a className="cb-btn cb-btn--secondary cb-btn--sm cb-top__action" href="#add">
              <Plus aria-hidden="true" size={16} strokeWidth={2} />
              <span>Add recipe</span>
            </a>
          )}
        </div>
      </header>

      <main className="cb-wrap cb-main">
        <div className="cb-intro">
          <h1 className="cb-display">What are we cooking?</h1>
          <p className="cb-lead">
            {RECIPES.length} recipes from weeknight braises to espresso martinis. Search by dish, ingredient or tag.
          </p>
        </div>

        <div className="cb-controls">
          <div className="cb-controls__row">
            <RadioPills label="Cuisine" options={cuisineOptions} value={cuisine} onChange={setCuisine} className="cb-pills--scroll" />
          </div>
          <div className="cb-controls__row cb-controls__row--split">
            <button
              type="button"
              className={"cb-pill" + (favOnly ? " is-on" : "")}
              aria-pressed={favOnly}
              onClick={() => setFavOnly((v) => !v)}
            >
              <Heart aria-hidden="true" size={15} strokeWidth={2} fill={favOnly ? "currentColor" : "none"} />
              Favourites
              <span className="cb-pill__count">{favs.size}</span>
            </button>
            <div className="cb-sort">
              <span className="cb-label">Sort</span>
              <RadioPills label="Sort recipes" options={SORTS} value={sort} onChange={setSort} className="cb-seg" />
            </div>
          </div>
        </div>

        <p className="cb-count" aria-live="polite">
          {filtered ? `${list.length} of ${RECIPES.length} recipes` : `${RECIPES.length} recipes`}
          {cuisine !== "All" ? ` · ${cuisine}` : ""}
          {favOnly ? " · favourites" : ""}
        </p>

        {list.length === 0 ? (
          <section className="cb-card cb-empty">
            <h2 className="cb-title">No recipes match</h2>
            <p className="cb-caption">
              {favOnly && favs.size === 0
                ? "You haven't saved any favourites yet. Tap the heart on a recipe to keep it here."
                : "Nothing fits that search and filter. Try a different word or clear the filters."}
            </p>
            <button type="button" className="cb-btn cb-btn--secondary cb-btn--sm" onClick={clearFilters}>
              Clear filters
            </button>
          </section>
        ) : (
          <ul className="cb-grid" role="list">
            {list.map((r, i) => (
              <li key={r.id} className="cb-recipe">
                <Photo recipe={r} className="cb-recipe__photo" eager={i < 6} />
                <div className="cb-recipe__body">
                  <div className="cb-recipe__kicker">
                    <span className="cb-label">{r.cuisine}</span>
                    {isNew(r) && <span className="cb-tag cb-tag--new">New</span>}
                  </div>
                  <h2 className="cb-recipe__title">
                    <a href={"#" + r.slug} className="cb-recipe__link">{r.title}</a>
                  </h2>
                  <div className="cb-meta">
                    <span><Clock aria-hidden="true" size={15} strokeWidth={2} />{fmtMinutes(totalMinutes(r))}</span>
                    {r.servings ? <span><Users aria-hidden="true" size={15} strokeWidth={2} />Serves {r.servings}</span> : null}
                  </div>
                  {r.tags?.length > 0 && (
                    <ul className="cb-tags" role="list" aria-label="Tags">
                      {r.tags.slice(0, 3).map((t) => <li key={t} className="cb-tag">{t}</li>)}
                    </ul>
                  )}
                </div>
                <div className="cb-recipe__fav">
                  <FavButton active={favs.has(r.id)} onClick={() => onToggleFav(r.id)} title={r.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
