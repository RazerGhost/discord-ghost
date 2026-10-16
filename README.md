# Ghost for Discord

A lightweight, glassy Discord theme: one blurred background behind the whole app and
translucent, rounded panels floating on it. It's the Discord sibling of
[Ghost for Spotify](https://github.com/RazerGhost/spicetify-ghost).

It comes in two parts:

- **The theme** (`ghost.theme.css`): plain CSS for Vencord, Equicord or
  BetterDiscord. You pick the background image and colours yourself in QuickCSS.
- **The plugin** (Vencord / Equicord): includes the theme and adds a settings
  page. It also uses the album art of whatever you're playing on Spotify as the
  (heavily blurred) background.

## Features

- **Background**: a heavily blurred, dimmed image (yours, or the current Spotify
  cover with the plugin) behind everything, so text on top stays easy to read. Panels are see-through instead of re-blurring what's
  behind them, so it stays cheap on the GPU.
- **Glass panels**: the server list, channel list, chat and user panel are separate
  rounded glass panels. The member list and message box sit inside the chat as a
  lighter layer.
- **Accent**: Discord's blurple is replaced everywhere (buttons, links, toggles,
  mentions) by a colour you pick. With the plugin it can follow the album art
  instead, if you want that.
- **Variants**: dark glass (default) or OLED (pure black panels). Discord's light
  theme gets light glass.

## Install the theme

### Vencord / Equicord: Online Themes (updates on its own)

Settings → **Themes** → **Online Themes**, then paste:

```
https://raw.githubusercontent.com/RazerGhost/discord-ghost/dist/ghost.theme.css
```

For the OLED variant, use `ghost-oled.theme.css` instead.

### Vencord / Equicord / BetterDiscord: file

Download [`ghost.theme.css`](https://raw.githubusercontent.com/RazerGhost/discord-ghost/dist/ghost.theme.css)
(or the [OLED variant](https://raw.githubusercontent.com/RazerGhost/discord-ghost/dist/ghost-oled.theme.css))
into your themes folder (Settings → Themes → **Open Themes Folder**) and enable it.
A downloaded file doesn't update itself.

Use Discord's **Dark**, **Darker** or **Midnight** appearance. Ghost ignores Nitro
colour themes and boosted servers' themes, so its colours stay yours everywhere; it
needs no Nitro itself.

## Customise the theme

Without the plugin, set any of these in QuickCSS (Settings → Themes → **Edit QuickCSS**):

```css
:root {
  --ghost-bg-image: url("https://i.imgur.com/your-image.jpg");
  --ghost-blur: 96px;
}
```

| Variable | Default | What it does |
| --- | --- | --- |
| `--ghost-bg-image` | `none` | Background image, as `url("…")`. `none` = just the colour |
| `--ghost-bg-color` | `#0b0b0f` | Colour behind (or instead of) the image |
| `--ghost-blur` | `96px` | Background blur. Use `0px` for an image that's already blurred |
| `--ghost-brightness` | `0.35` | Background brightness (1 = unchanged) |
| `--ghost-saturation` | `1.1` | Background saturation (1 = unchanged) |
| `--ghost-surface` | `#121216` | Panel colour before transparency (`#000` for OLED) |
| `--ghost-panel-alpha` | `0.5` | Panel opacity, 0–1 |
| `--ghost-border-alpha` | `0.06` | Panel edge highlight, 0–1 |
| `--ghost-radius` | `12px` | Panel corner radius |
| `--ghost-gap` | `8px` | Space between panels |
| `--ghost-accent` | `#b9a4ff` | Accent colour (replaces blurple) |
| `--ghost-tint` | `0%` | How much accent is mixed into the panels |

Discord only loads images from hosts it allows (Vencord adds imgur, GitHub, Discord's
own CDN and a few more). Other hosts may not show up.

## Install the plugin

The plugin is for Vencord and Equicord. It includes the theme, so turn off
`ghost.theme.css` if you enabled it. Its settings replace the QuickCSS variables.

Third-party plugins can't be added to the regular Vencord install. Vencord only loads
them as **userplugins**, built from source:

1. Install [git](https://git-scm.com), [Node.js](https://nodejs.org) 22+ and
   [pnpm](https://pnpm.io) (`npm i -g pnpm`).
2. Clone Vencord and install its dependencies:

   ```sh
   git clone https://github.com/Vendicated/Vencord
   cd Vencord
   pnpm install --frozen-lockfile
   ```

3. Copy the plugin: download [this repo's `dist` branch](https://github.com/RazerGhost/discord-ghost/archive/refs/heads/dist.zip),
   then copy its `ghost` folder to `Vencord/src/userplugins/ghost`.
4. Build and inject into Discord (close Discord first):

   ```sh
   pnpm build
   pnpm inject
   ```

5. Restart Discord → Settings → **Plugins** → enable **Ghost** and open its settings.

To update, replace the `ghost` folder, then `pnpm build` again. You only need
`pnpm inject` once. After a `git pull` of Vencord, also `pnpm build` again. Keep the
Vencord folder where it is: Discord runs Vencord from it. If a Discord update removes
Vencord, run `pnpm inject` again.

With a clone of this repo next to your Vencord folder, `npm run deploy`,
`npm run vencord:update` and `npm run vencord:inject` do these steps for you (see
[DEVELOPMENT.md](DEVELOPMENT.md)).

**Equicord** (an easier route is coming): Ghost is meant to be submitted to
[Equicord](https://github.com/Equicord/Equicord), a Vencord fork that ships community
plugins. Once it's accepted, you'll just turn it on in Equicord's plugin list. Until
then, the same userplugin steps work in an Equicord checkout.

### Plugin settings

- **Background**: album art from Spotify, a custom image, or a solid colour. With
  album art, your custom image (or the colour) shows while nothing plays. Blur,
  brightness, saturation, film grain.
- **Accent**: your own colour (default), from the album art, or Discord's blurple.
  Optional panel tint.
- **Layout**: dark glass or OLED, panel opacity, border, corner radius and gap.

Album art comes from Discord's own Spotify connection (Settings → Connections →
Spotify). You don't need Vencord's SpotifyControls plugin. The cover is blurred once
per song into a small image, so a playing track costs nothing per frame.

## Discord's Terms of Service

Client mods (Vencord, Equicord, BetterDiscord) are against
[Discord's Terms of Service](https://discord.com/terms). Discord isn't known to ban
anyone for themes or cosmetic plugins like this one, but the risk is yours to take.
Ghost only changes how Discord looks. It doesn't automate your account or send
anything anywhere. The plugin's only network requests load Spotify cover images
(i.scdn.co).

## Problems?

Discord updates sometimes change the parts of the app Ghost styles. If something
looks broken after an update, [open an issue](https://github.com/RazerGhost/discord-ghost/issues)
with a screenshot, and say whether you use the theme or the plugin.

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for the dev setup, selector rules, project
layout and how releases work.

## License

The theme and build scripts are [MIT](LICENSE). The plugin (`plugin/ghost`) is
GPL-3.0-or-later, like Vencord, which it's built into.
