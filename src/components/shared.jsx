import React from "react";
import { Heart } from "lucide-react";

/** Recipe photo with a fill-colour skeleton behind it while it loads. */
export function Photo({ recipe, className = "", eager = false }) {
  const [loadedSrc, setLoadedSrc] = React.useState(null);
  const loaded = loadedSrc === recipe.photo;
  if (!recipe.photo) return <div className={"cb-photo " + className} aria-hidden="true" />;
  return (
    <div className={"cb-photo " + className + (loaded ? " is-loaded" : "")}>
      <img
        src={recipe.photo}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={recipe.photoPosition ? { objectPosition: recipe.photoPosition } : undefined}
        onLoad={() => setLoadedSrc(recipe.photo)}
      />
    </div>
  );
}

/** Save/unsave toggle. State lives in aria-pressed, styling follows it. */
export function FavButton({ active, onClick, title, size = "md" }) {
  return (
    <button
      type="button"
      className={"cb-fav cb-fav--" + size}
      aria-pressed={active}
      aria-label={(active ? "Remove " : "Save ") + title + (active ? " from favourites" : " to favourites")}
      onClick={onClick}
    >
      <Heart aria-hidden="true" size={size === "lg" ? 20 : 18} strokeWidth={2} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
