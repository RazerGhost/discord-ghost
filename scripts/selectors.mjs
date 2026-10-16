// Checks Ghost's hooks against Discord's current CSS, so a Discord update that
// renames a class or drops a variable shows up here instead of in someone's
// broken layout.
//
//   node scripts/selectors.mjs   (npm run check:discord; CI runs it weekly)
//
// Downloads every stylesheet discord.com/app can load — the ones in the page,
// plus the lazy ones listed in web.*.js's CSS filename function (~1000 files, ~30 MB) —
// and looks for:
//   - each class prefix Ghost matches ([class^="sidebarList_"] → a class
//     sidebarList_<hash> or sidebarList__<hash>),
//   - each Discord variable Ghost sets or reads (--background-base-lower, …).
// Exits 1 if any is missing. Variables Discord only sets from JavaScript still
// count, as long as some Discord CSS reads them. data-list-id / role hooks live
// in Discord's markup, not its CSS, and aren't checked.

import { readFileSync } from "node:fs";

const ORIGIN = "https://discord.com";
const UA = { "User-Agent": "Mozilla/5.0 (discord-ghost selector check)" };

async function text(url) {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url, { headers: UA });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`${res.status} ${url}`);
            return await res.text();
        } catch (err) {
            if (attempt === 3) throw err;
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

/** Every stylesheet URL the app can load. */
async function stylesheets() {
    const html = await text(`${ORIGIN}/app`);
    if (!html) throw new Error("discord.com/app not found.");
    const urls = new Set([...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map(m => ORIGIN + m[1]));
    const web = html.match(/\/assets\/web\.[0-9a-f]+\.js/);
    if (!web) throw new Error("No web.*.js in discord.com/app; the page layout changed.");
    const js = (await text(ORIGIN + web[0])) ?? "";
    // The CSS filename function: a few chunks spelled out ("715528"===e?
    // ""+e+".<hash>.css"), the rest in a map whose files are just <hash>.css:
    // …:""+({10058:"1e832f6e47d2be49",…})[e]+".css"
    const end = js.search(/\}\)\[\w+\]\+"\.css"/);
    if (end < 0) throw new Error(`No CSS chunk map in ${web[0]}; the bundle layout changed.`);
    // Back to the arrow that starts the function (the map itself has none).
    const fn = js.slice(js.lastIndexOf("=>", js.lastIndexOf("({", end)), end);
    for (const [, id, hash] of fn.matchAll(/"(\w+)"===\w\?""\+\w\+"\.([0-9a-f]+)\.css"/g)) urls.add(`${ORIGIN}/assets/${id}.${hash}.css`);
    for (const [, file] of fn.matchAll(/===\w\?"([\w.]+\.css)"/g)) urls.add(`${ORIGIN}/assets/${file}`);
    const map = fn.slice(fn.lastIndexOf("({"));
    for (const [, hash] of map.matchAll(/:"([0-9a-f]{8,})"/g)) urls.add(`${ORIGIN}/assets/${hash}.css`);
    return [...urls];
}

async function download(urls, concurrency = 16) {
    const out = [];
    let next = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next < urls.length) out.push(await text(urls[next++]));
    }));
    // A few listed chunks have no CSS served; many missing means the URL
    // scheme changed (it did once: <id>.<hash>.css → <hash>.css).
    const missing = out.filter(css => css === null).length;
    console.log(`${urls.length - missing} downloaded, ${missing} not served.`);
    if (missing > urls.length / 10) throw new Error("Too many stylesheets not found; the asset URLs changed.");
    return out.filter(Boolean).join("\n");
}

/** Ghost's hooks into Discord, from the built theme. */
function hooks(css) {
    const prefixes = new Set([...css.matchAll(/\[class[\^*|]?="([A-Za-z][\w-]*?)_{1,2}"\]/g)].map(m => m[1]));
    const vars = new Set(
        [...css.matchAll(/(--[\w-]+)\s*:|var\((--[\w-]+)/g)]
            .map(m => m[1] ?? m[2])
            // --vc-*: Vencord plugins' own variables (SpotifyControls), not Discord's.
            .filter(v => !v.startsWith("--ghost-") && !v.startsWith("--__") && !v.startsWith("--vc-"))
    );
    return { prefixes, vars };
}

const theme = readFileSync(new URL("../dist/ghost.theme.css", import.meta.url), "utf8");
const { prefixes, vars } = hooks(theme);

const urls = await stylesheets();
console.log(`Downloading ${urls.length} Discord stylesheets…`);
const discord = await download(urls);
console.log(`${(discord.length / 1e6).toFixed(1)} MB of CSS.\n`);

const classNames = new Set([...discord.matchAll(/\.([A-Za-z][\w-]*?)_{1,2}[0-9a-f]{5,6}\b/g)].map(m => m[1]));
const missingPrefixes = [...prefixes].filter(p => !classNames.has(p));
const missingVars = [...vars].filter(v => !discord.includes(v));

for (const p of missingPrefixes) console.log(`missing class   ${p}_…`);
for (const v of missingVars) console.log(`missing var     ${v}`);

if (missingPrefixes.length || missingVars.length) {
    console.log("\nDiscord no longer has these. Find their replacements in Discord's current CSS (see DEVELOPMENT.md → Selector rules).");
    process.exit(1);
}
console.log(`All ${prefixes.size} class prefixes and ${vars.size} variables Ghost uses still exist in Discord's CSS.`);
