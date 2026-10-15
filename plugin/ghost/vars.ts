/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 RazerGhost
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The --ghost-* variables the plugin sets (settings, baked cover, accent), kept
// in a <style> element of Ghost's own as `:root:root { … }`.
// Not as inline style on <html>, as spicetify-ghost does: Discord rewrites
// <html>'s style attribute (font size on zoom, and on other state changes),
// which wiped them — the background vanished on alt-tab, hover or opening
// DevTools. :root:root (0,2,0) beats the theme's :root defaults and its
// html.theme-light overrides (0,1,1).

const vars = new Map<string, string>();
let style: HTMLStyleElement | null = null;
let pending = false;

function flush() {
    pending = false;
    if (!vars.size) {
        style?.remove();
        style = null;
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = "ghost-vars";
    }
    if (!style.isConnected) document.head.append(style);
    style.textContent = `:root:root {\n${[...vars].map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}`;
}

/** Batch the writes of one task (applySettings sets nine at once) into one
 *  style update — each update restyles the whole app. A microtask, not a
 *  frame: frames don't run while Discord is hidden in the tray. */
function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(flush);
}

export function setVar(name: string, value: string | undefined) {
    if (value === undefined) {
        if (!vars.delete(name)) return;
    } else {
        if (vars.get(name) === value) return;
        vars.set(name, value);
    }
    schedule();
}

export function clearVars() {
    vars.clear();
    pending = false;
    flush();
}
