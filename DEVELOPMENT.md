# Developing Ghost for Discord

How to work on Ghost, and how it gets from this repo to people's Discord. For
installing and using it, see the [README](README.md).

## Setup

### Theme

```powershell
npm install
npm run dev     # rebuilds dist\ on save
```

Then link the built theme into Vencord's themes folder, so Vencord reloads it on every
save. On Windows (in an admin or Developer Mode terminal):

```powershell
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\Vencord\themes\ghost.theme.css" -Target "$PWD\dist\ghost.theme.css"
```

On macOS / Linux, use `~/Library/Application Support/Vencord/themes` or
`~/.config/Vencord/themes`:

```sh
ln -s "$PWD/dist/ghost.theme.css" ~/.config/Vencord/themes/ghost.theme.css
```

Enable it under Settings → Themes. For Equicord the folder is `Equicord/themes`, and
for BetterDiscord it's `BetterDiscord/themes`. A hard link or copy won't follow
rebuilds: `build.mjs` replaces the file (it writes to a temp file and then renames
it), so use a symlink.

### Plugin

You need a Vencord checkout next to this repo (`git clone https://github.com/Vendicated/Vencord ..\Vencord`,
then `pnpm install --frozen-lockfile` inside it), or anywhere else with
`VENCORD_DIR` set. Then, from this repo:

```powershell
npm run vencord:inject   # once (Discord closed): points Discord at that Vencord build
npm run dev:discord      # while working: rebuilds Ghost and Vencord on every save
```

Reload Discord (Ctrl+R) to pick up a rebuild. On Windows, keep the checkout's path
short: pnpm hits the 260-character path limit in deep folders (`ENAMETOOLONG`).

| Script | What it does |
| --- | --- |
| `npm run build` | One-off build into `dist/`. Fails on CSS that doesn't parse |
| `npm run dev` | Rebuild `dist/` on save (`theme/` and `plugin/`) |
| `npm run check` | CSS syntax check of the built `dist/*.theme.css` |
| `npm run check:discord` | Checks that the class prefixes and Discord variables Ghost uses still exist in Discord's live CSS |
| `npm run deploy` | Build Ghost into the Vencord checkout and build Vencord; then Ctrl+R in Discord |
| `npm run dev:discord` | `deploy` on every save in `theme/` or `plugin/` (not Vencord's `pnpm watch`, which misses CSS-only changes) |
| `npm run vencord:update` | `git pull` + install + build the Vencord checkout, with Ghost |
| `npm run vencord:inject` | Vencord's installer: patch Discord again (e.g. after a Discord update removed Vencord) |

The checkout is what Discord runs, so don't move or delete it; a source build
doesn't update itself, which is what `vencord:update` is for. The scripts live in
`scripts/vencord.mjs`; `node build.mjs --vencord <dir>` is the copy step on its own.

Inside Vencord, `pnpm exec tsc --noEmit` type-checks and
`pnpm exec eslint src/userplugins/ghost` lints the plugin (CI runs both).

## Debugging

Open DevTools in Discord with Ctrl+Shift+I (Vencord enables it).

- `getComputedStyle(document.documentElement).getPropertyValue("--ghost-accent")`
  shows any Ghost variable as Discord sees it.
- With the plugin running, `<html>` has the class `ghost-plugin` (re-added if
  Discord rewrites `<html>`'s classes), plus `ghost-oled`,
  `ghost-grain`, `ghost-bg-solid` (source "Solid colour": the colour isn't dimmed) and
  `ghost-accent-off` when those are on. The settings, baked cover and accent are
  `--ghost-*` variables in `<style id="ghost-vars">` (not `<html>`'s inline style,
  which Discord rewrites).
- The baked cover is `--ghost-art` (a small `data:` image, about 1/8
  of the window size), painted as `<html>`'s background. `#ghost-bg` only exists
  for a custom image without CORS, drawn with a live CSS filter.
- No cover? `player.ts` only knows what Discord's Spotify connection reports
  (`SPOTIFY_PLAYER_STATE` events). Check that Spotify is connected under Settings →
  Connections and is playing on an active device.

## Selector rules

Discord changes its markup and renames its classes with updates, so other themes'
selectors go stale. So:

1. Take hooks only from Discord's current CSS and DOM, never from other themes. Its
   stylesheets are at `https://discord.com/assets/*.css`; the lazy-loaded ones are
   listed in the CSS chunk map in `web.*.js`.
2. Prefer, in order:
   1. **Discord's CSS variables**: `--background-base-*`, `--app-frame-*`,
      `--brand-*`, `--control-primary-*`, `--custom-guild-list-width`,
      `--custom-panels-spacing`, …
   2. **`data-list-id` / `role` / `aria-*`**: e.g. `[data-list-id="guildsnav"]`. Avoid
      `aria-label`: it's translated.
   3. **Class-name prefixes**: `[class^="sidebarList_"]`. Discord's classes are
      `name_hash` or `name__hash` (2025 builds have both), and the hash changes
      between builds. Short names (`page_`, `chat_`, `sidebar_`) exist in other
      modules too, so anchor them to their parent in the layout (`[class^="content_"] > [class^="page_"]`).
   4. Full hashed classes only as a last resort, with a comment.
3. Discord defines its variables on `.theme-dark` (and friends) on `<html>` and again on
   popout roots and in `@supports` blocks. Override them with `html:is(.theme-…)` /
   `html :is(.theme-…)`, which win whatever order the stylesheets load in.
4. No `backdrop-filter` on panels. The background is blurred once, either by
   `#app-mount::before` or by the plugin (once per cover, in a canvas exported as an
   image and painted as `<html>`'s background).
5. Never store state in `<html>`'s inline style or rely on it staying put:
   Discord rewrites `<html>`'s attributes. The plugin's variables live in its own
   `<style id="ghost-vars">`.

## Layout

| Path | What it does |
| --- | --- |
| `theme/styles/*.css` | The look, one file per area, joined in file-name order. |
| `theme/styles/00-base.css` | `--ghost-*` variables and their derived colours. |
| `theme/styles/10-background.css` | The blurred background (theme `::before`, plugin `#ghost-bg`). |
| `theme/styles/20-surfaces.css` | Discord's surface variables: transparent app, Ghost-coloured popouts; server and Nitro colour themes switched off. |
| `theme/styles/30-panels.css` | The glass panels and the layout map of Discord's DOM. |
| `theme/styles/40-activity.css` | Activity cards ("Listening to Spotify", games): inset glass, accent progress bar. |
| `theme/styles/50-spotify-controls.css` | Vencord's SpotifyControls player, folded into the user panel. |
| `theme/styles/90-accent.css` | Discord's brand variables → `--ghost-accent`. |
| `theme/variants/*.css` | Declarations only, used as `html.ghost-<name>` (plugin) and `ghost-<name>.theme.css`; dark themes only (`:not(.theme-light)`). |
| `plugin/ghost/index.tsx` | Vencord plugin definition: start/stop, injects `ghost.css`. |
| `plugin/ghost/settings.tsx` | `definePluginSettings` in sections (Background, Accent colour, Panels) → `--ghost-*` variables and classes on `<html>`. |
| `plugin/ghost/player.ts` | Current Spotify track from Discord's `SpotifyStore` (`TrackInfo`, `albumArt()`, `position()`). |
| `plugin/ghost/background.ts` | Cover blurred once (canvas → `data:` image) and painted as `<html>`'s background; last cover kept through pauses. Port of spicetify-ghost's. |
| `plugin/ghost/accent.ts` | Accent: the user's colour, or (opt-in) picked from a 32×32 sample of the cover or from the server theme's gradient. |
| `plugin/ghost/ghost.css` | Generated by the build from `theme/` (gitignored). |
| `build.mjs` | Joins the CSS, adds the meta header, writes the variants, copies the plugin. |
| `scripts/check.mjs` | CSS syntax check (also run by the build). |
| `scripts/selectors.mjs` | Ghost's hooks against Discord's live CSS (`check:discord`; weekly in CI). |
| `scripts/vencord.mjs` | `deploy` / `dev:discord` / `vencord:update` / `vencord:inject` against the Vencord checkout. |
| `docs/dist-README.md` | README of the `dist` branch. |

### Lyrics (planned)

spicetify-ghost's `src/lyrics/providers.ts`, `parse.ts` and `types.ts` don't depend on
Spotify's client except for the Spotify lyrics provider (which uses Spicetify's
CosmosAsync). They're meant to move to `plugin/ghost/lyrics/` mostly as they are.
`player.ts` already exports the same `TrackInfo`, and `position()` replaces
`Spicetify.Player.getProgress()`. AMLL and LRCLIB need their hosts allowed in
Vencord's CSP (`connect-src`), or fetching through Vencord's native side.

## Release

Push to `main`. The GitHub Action builds the theme, copies the plugin into a fresh
Vencord checkout and type-checks, lints and builds it there. If that passes, it
publishes `dist/` to the `dist` branch (force-pushed, one run at a time) and purges
jsDelivr's cache for `@dist`. Pull requests run the checks without publishing.

Every Monday, the **Discord check** workflow runs `npm run check:discord`. Discord
renames classes with its updates; a failed run (GitHub emails it) lists the hooks
that are gone, so they can be replaced before anyone reports a broken layout.

**Online Themes** load
`https://raw.githubusercontent.com/RazerGhost/discord-ghost/dist/ghost.theme.css`
every time Discord starts, so they get a release within GitHub's ~5 min cache.
Downloaded theme files and plugin copies don't update.

Bump `version` in `package.json` for releases worth announcing. It's the `@version`
in the theme's meta header.

### Equicord

Equicord is the way normal users get the plugin. To submit it, open a PR to
[Equicord](https://github.com/Equicord/Equicord) that adds `plugin/ghost` as
`src/equicordplugins/ghost/`. That means:

- Generate `ghost.css` in the PR, since Equicord won't run this build.
- Add RazerGhost to `EquicordDevs` (with a real Discord user id) instead of the inline
  author.
- Follow their lint and header rules (the GPL header is already there).
