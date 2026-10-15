/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 RazerGhost
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Accent colour (--ghost-accent; ghost.css maps it onto Discord's brand and
// control variables): from the album art, a custom colour, or Discord's own
// (html.ghost-accent-off, set by settings.ts).
// spicetify-ghost asks Spotify for the cover's extracted colours; Discord has no
// such API, so the colour is picked here from a 32×32 sample of the cover:
// the hue with the most saturated weight, made readable on dark glass.

import { albumArt, onTrackChange } from "./player";
import { settings, watchSettings } from "./settings";
import { setVar } from "./vars";

type Rgb = [number, number, number];

const SAMPLE = 32;

const toHex = (rgb: Rgb) => "#" + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Keep the hue, but bring saturation and lightness into a range that reads as
 *  an accent on dark glass: a cover's average colour is often muddy (dark
 *  reds come out brown). Spotify's extracted colours, which spicetify-ghost
 *  uses, are tuned the same way. */
function readable([r, g, b]: Rgb): Rgb {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let l = (max + min) / 2;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    s = Math.max(s, 0.5);
    l = Math.min(0.75, Math.max(0.6, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    const m = l - c / 2;
    return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/** Most vibrant colour of `img`; undefined for greyscale covers or when the
 *  canvas is tainted (no CORS). Hue buckets weighted by saturation, so a small
 *  vivid area beats a large dull one. */
export function vibrantColor(img: HTMLImageElement): string | undefined {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    let data: Uint8ClampedArray;
    try {
        data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    } catch {
        return undefined;
    }

    const buckets = Array.from({ length: 12 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const light = (max + min) / 510;
        if (max === min || light < 0.1 || light > 0.92) continue;
        const sat = (max - min) / (255 - Math.abs(max + min - 255));
        if (sat < 0.25) continue;
        let hue = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
        hue = (hue * 60 + 360) % 360;
        const bucket = buckets[Math.floor(hue / 30) % 12];
        const w = sat * sat;
        bucket.weight += w;
        bucket.r += r * w;
        bucket.g += g * w;
        bucket.b += b * w;
    }
    const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a));
    // Less than ~3 fully saturated pixels' worth: call it greyscale.
    if (best.weight < 3) return undefined;
    return toHex(readable([best.r / best.weight, best.g / best.weight, best.b / best.weight]));
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function setAccent(hex: string | undefined) {
    setVar("--ghost-accent", hex);
}

const customAccent = () => (/^#[\da-f]{6}$/i.test(settings.store.accentColor.trim()) ? settings.store.accentColor.trim() : undefined);

let lastArt = "";
let artAccent: string | undefined;

async function updateAccent() {
    const s = settings.store;
    if (s.accentSource === "discord") return setAccent(undefined);
    if (s.accentSource === "custom") return setAccent(customAccent());

    const art = albumArt();
    if (!art) return setAccent(customAccent()); // nothing playing
    if (art !== lastArt) {
        lastArt = art;
        artAccent = await loadImage(art).then(vibrantColor, () => undefined);
        // A newer track or setting change may have landed while it loaded.
        if (art !== albumArt() || settings.store.accentSource !== "spotify") return;
    }
    setAccent(artAccent ?? customAccent());
}

let unsubscribe: (() => void)[] = [];

export function startAccent() {
    unsubscribe = [
        onTrackChange(updateAccent),
        watchSettings(s => [s.accentSource, s.accentColor], updateAccent),
    ];
}

export function stopAccent() {
    unsubscribe.forEach(u => u());
    unsubscribe = [];
    lastArt = "";
    artAccent = undefined;
    setAccent(undefined);
}
