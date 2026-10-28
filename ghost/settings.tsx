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

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { makeRange, OptionType } from "@utils/types";

import { clearVars, setVar } from "./vars";

const isHex = (value: string) => /^#[\da-f]{6}$/i.test(value.trim()) || "Use a hex colour, like #b9a4ff";

/** Slider labels in whole units, for componentProps (passed on to Discord's
 *  slider, which would show "47.38"). Dragging between markers still stores a
 *  fraction; the values are rounded where they're applied. */
const unit = (suffix: string) => ({
    onValueRender: (v: number) => `${Math.round(v)}${suffix}`,
    onMarkerRender: (v: number) => `${v}${suffix}`,
});

/** Every option calls this; it applies the CSS side and tells the watchers. */
function changed() {
    applySettings();
    listeners.forEach(l => l());
}

/** A section heading in the settings list (a setting with no value of its own).
 *  A function as description is read each time the settings open. */
function section(title: string, description: string | (() => string), first = false) {
    return {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                {!first && <Divider className={Margins.bottom16} />}
                <HeadingSecondary>{title}</HeadingSecondary>
                <Paragraph>{typeof description === "function" ? description() : description}</Paragraph>
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
        description: "The solid colour. With an image, it shows while nothing plays or the image loads, dimmed like the image.",
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
        componentProps: unit(" px"),
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
        componentProps: unit("%"),
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
        componentProps: unit("%"),
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
            { label: "From the server's theme", value: "server" },
            { label: "From matugen", value: "matugen" },
            { label: "Discord's blurple", value: "discord" },
        ],
        onChange: changed,
    },
    accentColor: {
        type: OptionType.STRING,
        displayName: "Colour",
        description: "Hex. With album art, server themes or matugen, it's used while nothing plays, the server has no theme or there's no matugen theme.",
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
        componentProps: unit("%"),
        hidden: discordAccent,
        onChange: changed,
    },

    panelsSection: section("Panels", "The glass panels: server list, channels, chat and user panel."),
    matugenColors: {
        type: OptionType.BOOLEAN,
        displayName: "Colours from matugen",
        description: "Panel and background colours from the ghost-matugen.css theme a matugen template writes (see Ghost's README). Without that theme, Ghost's own colours stay. The OLED style keeps panels black.",
        default: false,
        onChange: changed,
    },
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
        componentProps: unit("%"),
        onChange: changed,
    },
    borderOpacity: {
        type: OptionType.SLIDER,
        displayName: "Edge",
        description: "Strength of the thin line around each panel, in %.",
        markers: makeRange(0, 40, 5),
        default: 6,
        stickToMarkers: false,
        componentProps: unit("%"),
        onChange: changed,
    },
    radius: {
        type: OptionType.SLIDER,
        displayName: "Corner radius",
        description: "In pixels.",
        markers: makeRange(0, 32, 4),
        default: 12,
        stickToMarkers: false,
        componentProps: unit(" px"),
        onChange: changed,
    },
    gap: {
        type: OptionType.SLIDER,
        displayName: "Gap",
        description: "Space between panels, in pixels.",
        markers: makeRange(0, 24, 4),
        default: 8,
        stickToMarkers: false,
        componentProps: unit(" px"),
        onChange: changed,
    },

    // Ghost styles SpotifyControls' player (50-spotify-controls.css) rather
    // than shipping its own: the player is Vencord's to maintain, and two
    // players would stack in the user panel.
    pairsSection: section("Works with", () =>
        "SpotifyControls: a Spotify player above your account, which Ghost folds into the user panel in your accent. "
        + (isPluginEnabled("SpotifyControls") ? "It's on." : "Turn it on under Plugins to add it.")
    ),
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

/** A matugen colour from the ghost-matugen.css theme, with `fallback` for when
 *  that theme isn't installed or enabled. Vencord reloads the theme when
 *  matugen rewrites it, so references update live. */
export const matugen = (on: boolean, name: string, fallback: string) => (on ? `var(${name}, ${fallback})` : fallback);

const CLASSES = ["ghost-plugin", "ghost-oled", "ghost-grain", "ghost-bg-solid", "ghost-accent-off"];

export function applySettings() {
    const s = settings.store;
    const vars: Record<string, string> = {
        "--ghost-blur": `${Math.round(s.blur)}px`,
        "--ghost-brightness": `${Math.round(s.brightness) / 100}`,
        "--ghost-saturation": `${Math.round(s.saturation) / 100}`,
        "--ghost-bg-color": matugen(s.matugenColors, "--matugen-background", isHex(s.bgColor) === true ? s.bgColor.trim() : "#0b0b0f"),
        "--ghost-panel-alpha": `${Math.round(s.panelOpacity) / 100}`,
        "--ghost-border-alpha": `${Math.round(s.borderOpacity) / 100}`,
        "--ghost-radius": `${Math.round(s.radius)}px`,
        "--ghost-gap": `${Math.round(s.gap)}px`,
        "--ghost-tint": `${Math.round(s.tint)}%`,
    };
    for (const [name, value] of Object.entries(vars)) setVar(name, value);
    // Unset, the theme's own surface applies (and its light-theme one).
    setVar("--ghost-surface", s.matugenColors ? matugen(true, "--matugen-surface", "#121216") : undefined);
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
        "ghost-bg-solid": s.bgSource === "solid",
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
