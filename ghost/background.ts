/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 RazerGhost
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Background, ported from spicetify-ghost/src/background.ts. Source is the
// Spotify cover, a custom image URL, or nothing (solid colour); with album art,
// the custom image (or the colour) stands in until the first cover arrives.
// After that the last cover stays: Discord reports "no track" whenever Spotify
// pauses, and blanking the background on every pause flickers.
//
// Performance: the image is blurred ONCE per cover into a small canvas (1/SCALE
// of the window, brightness/saturation baked in), exported as a small image, and
// painted as <html>'s own background (--ghost-art, set through vars.ts;
// ghost.css stretches it), so there's no live CSS filter for Chromium to redo
// on every frame. Changing the image crossfades through a background-image
// transition.
//
// One element fewer than spicetify-ghost's two crossfading layers: <html>'s own
// background is painted with the page, needs no stacking tricks behind
// Discord's layers, and crossfades by itself.
//
// i.scdn.co sends Access-Control-Allow-Origin: *, so covers can be read back.
// Custom images without CORS can't be baked; they're shown in #ghost-bg with a
// live CSS filter instead (#ghost-bg in ghost.css).

import { albumArt, onTrackChange } from "./player";
import { type Settings, settings, watchSettings } from "./settings";
import { setVar } from "./vars";

/** Canvas is rendered at 1/SCALE of the window and upscaled; invisible after a heavy blur. */
const SCALE = 8;

/** Layer for the live-filter fallback only. */
let live: HTMLElement | null = null;
let lastImage = "";
/** Last album cover seen, kept through pauses. */
let lastArt: string | undefined;
/** Decoded image currently shown — kept so slider/size changes can re-bake it. */
let shownImage: HTMLImageElement | null = null;

function wantedImage(s: Settings): string {
    if (s.bgSource === "solid") return "";
    const custom = s.bgImageUrl.trim();
    if (s.bgSource === "custom") return custom;
    lastArt = albumArt() ?? lastArt;
    return lastArt ?? custom;
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (cors) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/** Blur + colour-adjust `img` into a small canvas; a data: URL of it, or null if
 *  it can't be baked (an image loaded without CORS taints the canvas).
 *  data: rather than blob: URLs, since Discord's CSP allows those for images
 *  and the result is only a few KB. */
function bake(img: HTMLImageElement, s: Settings): string | null {
    if (!img.crossOrigin) return null;
    const w = Math.max(16, Math.ceil(innerWidth / SCALE));
    const h = Math.max(16, Math.ceil(innerHeight / SCALE));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const blur = Math.round(s.blur) / SCALE;
    ctx.filter = `blur(${blur}px) brightness(${Math.round(s.brightness) / 100}) saturate(${Math.round(s.saturation) / 100})`;
    // "cover" crop, overscanned by 2× the blur so the edges don't fade to transparent.
    const bleed = blur * 2;
    const scale = Math.max((w + bleed * 2) / img.naturalWidth, (h + bleed * 2) / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    try {
        return canvas.toDataURL("image/jpeg", 0.9);
    } catch {
        return null;
    }
}

function show(img: HTMLImageElement | null) {
    const baked = img && bake(img, settings.store);
    setVar("--ghost-art", baked ? `url("${baked}")` : undefined);

    const needsLive = !!img && !baked;
    if (needsLive && !live) {
        live = document.createElement("div");
        live.id = "ghost-bg";
        live.setAttribute("aria-hidden", "true");
        // In <body>, not #app-mount: React owns #app-mount's children.
        document.body.prepend(live);
    }
    if (live) {
        if (needsLive) live.style.setProperty("--ghost-art", `url("${CSS.escape(img!.src)}")`);
        else {
            live.remove();
            live = null;
        }
    }
}

async function updateImage() {
    const src = wantedImage(settings.store);
    if (src === lastImage) return;
    lastImage = src;

    if (!src) {
        shownImage = null;
        show(null);
        return;
    }
    let img: HTMLImageElement;
    try {
        // CORS first (so it can be baked); custom URLs without CORS fail that way,
        // so retry plainly and use the live CSS filter for those.
        img = await loadImage(src, true).catch(() => loadImage(src, false));
    } catch {
        console.warn("[Ghost] couldn't load background image", src);
        lastImage = ""; // allow a retry on the next track / settings change
        return;
    }
    if (src !== lastImage) return; // something newer arrived while loading
    shownImage = img;
    show(img);
}

let rebakeTimer: number | undefined;
/** Re-bake the current image (blur/colour sliders, window size), debounced. */
const rebakeSoon = (delay: number) => {
    clearTimeout(rebakeTimer);
    rebakeTimer = window.setTimeout(() => shownImage && show(shownImage), delay);
};
const onResize = () => rebakeSoon(300);

let unsubscribe: (() => void)[] = [];

export function startBackground() {
    // Source settings → reload; filter settings → re-bake (sliders fire
    // continuously); window size → re-bake for the new aspect ratio.
    unsubscribe = [
        onTrackChange(updateImage),
        watchSettings(s => [s.bgSource, s.bgImageUrl], updateImage),
        watchSettings(s => [s.blur, s.brightness, s.saturation], () => rebakeSoon(60)),
    ];
    window.addEventListener("resize", onResize);
}

export function stopBackground() {
    unsubscribe.forEach(u => u());
    unsubscribe = [];
    window.removeEventListener("resize", onResize);
    clearTimeout(rebakeTimer);
    shownImage = null;
    show(null);
    lastImage = "";
    lastArt = undefined;
}
