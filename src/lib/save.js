// Owner tools on the live Claude page: who's viewing, photo uploads, and saving.
// Outside the Claude viewer (local dev, Vercel) every tool is null and the page is read-only.
import React from "react";
import { renderDocument } from "./pageTemplate.js";

async function use(name) {
  try { return (await window.claude?.use?.(name)) ?? null; } catch { return null; }
}

/** { ready, isOwner, artifact, assets, sample, imagesAllowed } — owner-only tools. */
export function useOwnerTools() {
  const [state, setState] = React.useState({ ready: false, isOwner: false, artifact: null, assets: null, sample: null, imagesAllowed: false });
  React.useEffect(() => {
    let live = true;
    (async () => {
      const user = await use("user");
      const isOwner = (await user?.isOwner?.().catch(() => false)) ?? false;
      const [artifact, assets, sample] = isOwner ? await Promise.all([use("artifact"), use("assets"), use("sample")]) : [null, null, null];
      const limits = sample ? await sample.limits?.().catch(() => null) : null;
      if (live) setState({ ready: true, isOwner: isOwner && !!artifact, artifact, assets, sample, imagesAllowed: !!limits?.images });
    })();
    return () => { live = false; };
  }, []);
  return state;
}

/** Shrink a photo on this device before upload: long side ≤ 1400px, WebP. */
export async function shrinkPhoto(file, max = 1400) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.8));
  if (blob && blob.type === "image/webp") return blob;
  // Safari can't encode WebP: fall back to JPEG.
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
}

/** Upload a photo and return its durable src for the recipe ("/_blob/<id>"). */
export async function uploadPhoto(assets, file) {
  const blob = await shrinkPhoto(file);
  const res = await assets.upload(blob, { type: blob.type });
  return "/_blob/" + res.id;
}

/**
 * Republish the page with a new recipe list. On success the viewer reloads to the
 * new version. Rejects with {code} — see messageFor().
 */
export async function saveRecipes(artifact, recipes) {
  const css = document.getElementById("app-css")?.textContent;
  const js = document.getElementById("app-js")?.textContent;
  if (css == null || js == null) throw { code: "not_live" };
  return artifact.publish(renderDocument({ css, js, recipes }));
}

export function messageFor(err) {
  switch (err?.code) {
    case "conflict": return "The page changed somewhere else while you were editing. It's reloading with the latest version.";
    case "not_writer":
    case "not_granted":
    case "consent_required": return "This view can't save changes. Open the cookbook from your own Claude account to add recipes.";
    case "capability_disabled":
    case "capability_removed": return "Saving isn't available in this view. Try opening the cookbook from claude.ai.";
    case "too_large": return "The page is too big to save. Try a smaller photo or remove an old recipe.";
    case "rate_limited": return "Saving too often. Wait a minute, then save again.";
    case "unsupported_type": return "That photo type isn't supported. Use a JPG, PNG or WebP.";
    case "quota_or_state": return "Photo storage is full. Save without a photo or remove one you don't need.";
    case "not_live": return "Saving only works on the live cookbook page.";
    default: return "Couldn't save just now. Your recipe is still here, so try again.";
  }
}
