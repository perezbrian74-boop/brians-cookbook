import React from "react";
import { readRecipes, loadFavs, saveFavs } from "./lib/recipes.js";
import { useOwnerTools, saveRecipes, messageFor } from "./lib/save.js";
import Browse from "./components/Browse.jsx";
import RecipePage from "./components/RecipePage.jsx";
import CookMode from "./components/CookMode.jsx";
import RecipeForm from "./components/RecipeForm.jsx";

// Routes live in the hash as a plain name so every recipe has a shareable link:
//   (empty) → browse · #<slug> → recipe · #cook-<slug> → cook mode
//   #add · #edit-<slug> → owner-only form
function readRoute(bySlug) {
  const h = decodeURIComponent(window.location.hash.slice(1));
  if (h === "add") return { view: "add", hash: h };
  if (h.startsWith("edit-") && bySlug.has(h.slice(5))) return { view: "edit", slug: h.slice(5), hash: h };
  if (h.startsWith("cook-") && bySlug.has(h.slice(5))) return { view: "cook", slug: h.slice(5), hash: h };
  if (bySlug.has(h)) return { view: "recipe", slug: h, hash: h };
  return { view: "browse", hash: "" };
}

// A typed-but-unsaved form survives a reload (e.g. a save conflict) in sessionStorage.
const DRAFT_KEY = "cookbook.draft";
function loadDraft(recipes) {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!d) return null;
    // The save it belonged to went through: drop it.
    const landed = d.savedStamp ? recipes.some((r) => r.updatedAt === d.savedStamp)
      : d.deletedId != null ? !recipes.some((r) => r.id === d.deletedId) : false;
    if (landed) { sessionStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
function storeDraft(d) {
  try { d ? sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : sessionStorage.removeItem(DRAFT_KEY); } catch { /* blocked */ }
}

export default function App() {
  const [recipes, setRecipes] = React.useState(readRecipes);
  const bySlug = React.useMemo(() => new Map(recipes.map((r) => [r.slug, r])), [recipes]);
  const [hash, setHash] = React.useState(() => window.location.hash);
  const route = React.useMemo(() => readRoute(bySlug), [bySlug, hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const [favs, setFavs] = React.useState(loadFavs);
  const [draft, setDraft] = React.useState(() => loadDraft(readRecipes()));
  const tools = useOwnerTools();
  // One cooking session at a time: servings + ticked ingredients follow the recipe
  // between its page and cook mode, and reset when you open a different one.
  const [session, setSession] = React.useState({ slug: null, servings: 0, checked: new Set() });
  const browseScroll = React.useRef(0);
  const lastView = React.useRef(route.view);

  React.useEffect(() => {
    const onHash = () => {
      if (lastView.current === "browse") browseScroll.current = window.scrollY;
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const slug = route.slug;
  React.useEffect(() => {
    if (!slug || !bySlug.has(slug)) return;
    setSession((s) => (s.slug === slug ? s : { slug, servings: bySlug.get(slug).servings || 4, checked: new Set() }));
  }, [slug, bySlug]);

  React.useLayoutEffect(() => {
    lastView.current = route.view;
    window.scrollTo(0, route.view === "browse" ? browseScroll.current : 0);
    const r = slug && bySlug.get(slug);
    document.title = route.view === "add" ? "Add a recipe · Brian's Cookbook"
      : r ? `${r.title} · Brian's Cookbook` : "Brian's Cookbook";
  }, [route.view, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFav(id) {
    setFavs((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      saveFavs(n);
      return n;
    });
  }
  function toggleCheck(i) {
    setSession((s) => {
      const checked = new Set(s.checked);
      checked.has(i) ? checked.delete(i) : checked.add(i);
      return { ...s, checked };
    });
  }
  const setServings = (fn) => setSession((s) => ({ ...s, servings: typeof fn === "function" ? fn(s.servings) : fn }));

  /**
   * Republish the page with `next`. Shows the result right away, then the viewer reloads
   * to the saved version. Returns an error message if it failed (and puts things back).
   */
  async function save(next, landHash, formDraft) {
    storeDraft(formDraft);
    const prev = recipes;
    setRecipes(next);
    window.location.hash = landHash;
    try {
      await saveRecipes(tools.artifact, next);
      storeDraft(null);
      setDraft(null);
      return null;
    } catch (err) {
      if (err?.code === "conflict") return messageFor(err); // the view is reloading to the latest version
      const text = messageFor(err);
      setRecipes(prev);
      const failed = { ...formDraft, error: { tone: "error", text } };
      storeDraft(failed);
      setDraft(failed);
      window.location.hash = formDraft.route;
      return text;
    }
  }
  function discardDraft() { storeDraft(null); setDraft(null); }

  // Owner-only screens: wait for the owner check, then fall back to the public view.
  if (route.view === "add" || route.view === "edit") {
    if (!tools.ready) return <div className="cb-page" aria-busy="true" />;
    if (tools.isOwner) {
      const recipe = route.view === "edit" ? bySlug.get(route.slug) : null;
      return (
        <RecipeForm key={route.hash} recipe={recipe} recipes={recipes} tools={tools} route={route.hash}
          draft={draft} onSave={save} onDiscardDraft={discardDraft} />
      );
    }
    if (route.view === "add") return <Browse recipes={recipes} favs={favs} onToggleFav={toggleFav} isOwner={false} />;
  }

  if (route.view === "browse") {
    return <Browse recipes={recipes} favs={favs} onToggleFav={toggleFav} isOwner={tools.isOwner} />;
  }

  const recipe = bySlug.get(route.slug);
  const ready = session.slug === route.slug;
  const servings = ready ? session.servings : recipe.servings || 4;
  const checked = ready ? session.checked : new Set();

  if (route.view === "cook") {
    return <CookMode recipe={recipe} servings={servings} checked={checked} onToggleCheck={toggleCheck} />;
  }
  return (
    <RecipePage
      recipe={recipe}
      servings={servings}
      setServings={setServings}
      checked={checked}
      onToggleCheck={toggleCheck}
      isFav={favs.has(recipe.id)}
      onToggleFav={() => toggleFav(recipe.id)}
      isOwner={tools.isOwner}
    />
  );
}
