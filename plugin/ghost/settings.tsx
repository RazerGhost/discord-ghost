/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 RazerGhost
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Defaults favour reading: Discord is read all day, so the background is blurred
// heavily and dimmed, and the accent is the user's own colour (album art is opt-in).
//
// Settings live in Vencord's plugin settings and are mirrored as CSS variables
// (--ghost-*, see vars.ts) and classes on <html> (ghost-oled, ghost-grain, …), like
// spicetify-ghost's settings/store.ts. ghost.css reads those, so most settings
// are purely a CSS concern; background.ts and accent.ts watch the rest.

import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { makeRange, OptionType } from "@utils/types";

import { clearVars, setVar } from "./vars";

const isHex = (value: string) => /^#[\da-f]{6}$/i.test(value.trim()) || "Use a hex colour, like #b9a4ff";

/** Every option calls this; it applies the CSS side and tells the watchers. */
function changed() {
    applySettings();
    listeners.forEach(l => l());
}

/** A section heading in the settings list (a setting with no value of its own). */
function section(title: string, description: string, first = false) {
    return {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                {!first && <Divider className={Margins.bottom16} />}
                <HeadingSecondary>{title}</HeadingSecondary>
                <Paragraph>{description}</Paragraph>
            </div>
        ),
    } as const;
}

const noImage = () => settings.store.bgSource === "solid";
const discordAccent = () => settings.store.accentSource === "discord";

// Grouped into sections (Vencord shows settings in definition order), and each
// setting only shows when it applies. The keys are what Vencord stores, so
// they stay as they are; displayName is the label shown.
export const settings = definePluginSettings({
    backgroundSection: section("Background", "What's behind the panels. Heavily blurred, so text on top stays easy to read.", true),
    bgSource: {
        type: OptionType.SELECT,
        displayName: "Source",
        description: "The album art follows what you're playing on Spotify.",
        options: [
            { label: "Album art from Spotify", value: "spotify", default: true },
            { label: "Custom image", value: "custom" },
            { label: "Solid colour", value: "solid" },
        ],
        onChange: changed,
    },
    bgImageUrl: {
        type: OptionType.STRING,
        displayName: "Image URL",
        description: "Your own image. With album art, it shows while nothing plays. Discord only loads images from hosts it allows (imgur, GitHub, Discord's CDN…).",
        placeholder: "https://i.imgur.com/….png",
        default: "",
        hidden: noImage,
        onChange: changed,
    },
    bgColor: {
        type: OptionType.STRING,
        displayName: "Colour",
        description: "The solid colour, and what shows while an image loads.",
        default: "#0b0b0f",
        isValid: isHex,
        onChange: changed,
    },
    blur: {
        type: OptionType.SLIDER,
        displayName: "Blur",
        description: "In pixels.",
        markers: makeRange(0, 160, 20),
        default: 96,
        stickToMarkers: false,
        hidden: noImage,
        onChange: changed,
    },
    brightness: {
        type: OptionType.SLIDER,
        displayName: "Brightness",
        description: "In %. Lower keeps text readable on bright covers.",
        markers: makeRange(0, 200, 25),
        default: 35,
        stickToMarkers: false,
        hidden: noImage,
        onChange: changed,
    },
    saturation: {
        type: OptionType.SLIDER,
        displayName: "Saturation",
        description: "In %.",
        markers: makeRange(0, 250, 50),
        default: 110,
        stickToMarkers: false,
        hidden: noImage,
        onChange: changed,
    },
    grain: {
        type: OptionType.BOOLEAN,
        displayName: "Film grain",
        description: "A faint noise over the background.",
        default: true,
        hidden: noImage,
        onChange: changed,
    },

    accentSection: section("Accent colour", "Buttons, links, toggles and mentions. Independent of the background: keep the album-art background and still pick your own colour."),
    accentSource: {
        type: OptionType.SELECT,
        displayName: "Source",
        description: "Where the accent comes from.",
        options: [
            { label: "My colour", value: "custom", default: true },
            { label: "From the album art", value: "spotify" },
            { label: "Discord's blurple", value: "discord" },
        ],
        onChange: changed,
    },
    accentColor: {
        type: OptionType.STRING,
        displayName: "Colour",
        description: "Hex. With album art, it's used while nothing plays.",
        default: "#b9a4ff",
        isValid: isHex,
        hidden: discordAccent,
        onChange: changed,
    },
    tint: {
        type: OptionType.SLIDER,
        displayName: "Tint panels",
        description: "How much of the accent is mixed into the panels, in %. 0 = off.",
        markers: makeRange(0, 40, 10),
        default: 0,
        stickToMarkers: false,
        hidden: discordAccent,
        onChange: changed,
    },

    panelsSection: section("Panels", "The glass panels: server list, channels, chat and user panel."),
    variant: {
        type: OptionType.SELECT,
        displayName: "Style",
        description: "OLED makes the panels, menus and settings pure black.",
        options: [
            { label: "Dark glass", value: "dark", default: true },
            { label: "OLED (black)", value: "oled" },
        ],
        onChange: changed,
    },
    panelOpacity: {
        type: OptionType.SLIDER,
        displayName: "Opacity",
        description: "In %. Higher = less background showing through.",
        markers: makeRange(0, 100, 10),
        default: 50,
        stickToMarkers: false,
        onChange: changed,
    },
    borderOpacity: {
        type: OptionType.SLIDER,
        displayName: "Edge",
        description: "Strength of the thin line around each panel, in %.",
        markers: makeRange(0, 40, 5),
        default: 6,
        stickToMarkers: false,
        onChange: changed,
    },
    radius: {
        type: OptionType.SLIDER,
        displayName: "Corner radius",
        description: "In pixels.",
        markers: makeRange(0, 32, 4),
        default: 12,
        stickToMarkers: false,
        onChange: changed,
    },
    gap: {
        type: OptionType.SLIDER,
        displayName: "Gap",
        description: "Space between panels, in pixels.",
        markers: makeRange(0, 24, 4),
        default: 8,
        stickToMarkers: false,
        onChange: changed,
    },
});

export type Settings = typeof settings.store;

const listeners = new Set<() => void>();

/** Call `onChange` only when the selected setting(s) change. `select` returns a
 *  value or array of values; they're compared by value. Returns an unsubscribe. */
export function watchSettings(select: (s: Settings) => unknown, onChange: () => void) {
    const key = () => JSON.stringify(select(settings.store));
    let last = key();
    const listener = () => {
        const next = key();
        if (next === last) return;
        last = next;
        onChange();
    };
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

const CLASSES = ["ghost-plugin", "ghost-oled", "ghost-grain", "ghost-accent-off"];

export function applySettings() {
    const s = settings.store;
    const vars: Record<string, string> = {
        "--ghost-blur": `${s.blur}px`,
        "--ghost-brightness": `${s.brightness / 100}`,
        "--ghost-saturation": `${s.saturation / 100}`,
        "--ghost-bg-color": isHex(s.bgColor) === true ? s.bgColor.trim() : "#0b0b0f",
        "--ghost-panel-alpha": `${s.panelOpacity / 100}`,
        "--ghost-border-alpha": `${s.borderOpacity / 100}`,
        "--ghost-radius": `${s.radius}px`,
        "--ghost-gap": `${s.gap}px`,
        "--ghost-tint": `${s.tint}%`,
    };
    for (const [name, value] of Object.entries(vars)) setVar(name, value);
    applyClasses();
    watchClasses();
}

/** Ghost's classes on <html>, as the settings want them. */
function wantedClasses() {
    const s = settings.store;
    return {
        "ghost-plugin": true,
        "ghost-oled": s.variant === "oled",
        "ghost-grain": s.grain && s.bgSource !== "solid",
        "ghost-accent-off": s.accentSource === "discord",
    };
}

function applyClasses() {
    const { classList } = document.documentElement;
    for (const [name, on] of Object.entries(wantedClasses())) {
        if (classList.contains(name) !== on) classList.toggle(name, on);
    }
}

// Discord manages <html>'s attributes itself (it rewrote the style attribute,
// see vars.ts), so guard the classes too: put them back whenever they go
// missing. applyClasses only writes when something's missing, so the observer
// can't trigger itself in a loop.
let classObserver: MutationObserver | null = null;

function watchClasses() {
    if (classObserver) return;
    classObserver = new MutationObserver(applyClasses);
    classObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

export function clearSettings() {
    clearVars();
    classObserver?.disconnect();
    classObserver = null;
    document.documentElement.classList.remove(...CLASSES);
    listeners.clear();
}
