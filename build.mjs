// Builds dist/ from theme/ and plugin/:
//   dist/ghost.theme.css       the theme (Vencord / BetterDiscord, with a BD-style meta header)
//   dist/ghost-oled.theme.css  the same with the OLED variant applied
//   dist/ghost/                the Vencord userplugin, ready to copy into src/userplugins
//   dist/README.md, LICENSE    so the dist branch explains itself
// The theme is theme/styles/*.css joined in file-name order (00-…, 10-…).
// theme/variants/*.css hold declarations only: each is emitted as
// `html.ghost-<name> { … }` in the main theme (the plugin toggles that class) and
// as `:root:root { … }` in its own ghost-<name>.theme.css.
//
//   node build.mjs                      one-off build
//   node build.mjs --dev                rebuild on change
//   node build.mjs --vencord <dir>      also copy the plugin into <dir>/src/userplugins/ghost
//                                       (combine with --dev, and run `pnpm watch` in <dir>)

import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
import { validate } from "./scripts/check.mjs";

const args = process.argv.slice(2);
const dev = args.includes("--dev");
const vencordIndex = args.indexOf("--vencord");
const vencord = vencordIndex === -1 ? null : args[vencordIndex + 1];
if (vencordIndex !== -1 && !vencord) throw new Error("--vencord needs the path to a Vencord checkout");

const STYLES = "theme/styles";
const VARIANTS = "theme/variants";
const PLUGIN = "plugin/ghost";

/** Write via a temp file + rename, so Vencord's theme watcher never reads a half-written file. */
async function writeAtomic(path, contents) {
    await writeFile(`${path}.tmp`, contents);
    await rename(`${path}.tmp`, path);
}

const cssFiles = async dir => (await readdir(dir)).filter(f => f.endsWith(".css")).sort();

function header(pkg, name, description) {
    return [
        "/**",
        ` * @name ${name}`,
        " * @author RazerGhost",
        ` * @description ${description}`,
        ` * @version ${pkg.version}`,
        " * @source https://github.com/RazerGhost/discord-ghost",
        " * @website https://github.com/RazerGhost/discord-ghost",
        " */",
        "",
    ].join("\n");
}

/** A variant file without its leading comment, indented as a rule body. */
const variantBody = css => css.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "").trim().replace(/^/gm, "  ");

async function build() {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const files = await cssFiles(STYLES);
    const parts = await Promise.all(files.map(f => readFile(join(STYLES, f), "utf8")));
    const variants = await Promise.all((await cssFiles(VARIANTS)).map(async f => ({
        name: f.replace(/\.css$/, ""),
        body: variantBody(await readFile(join(VARIANTS, f), "utf8")),
    })));

    const body = [
        ...parts.map((css, i) => `/* ${files[i]} */\n${css.trim()}\n`),
        ...variants.map(v => `/* variants/${v.name}.css (plugin: html.ghost-${v.name}) */\nhtml.ghost-${v.name} {\n${v.body}\n}\n`),
    ].join("\n");

    const outputs = {
        "dist/ghost.theme.css": header(pkg, "Ghost", pkg.description) + body,
    };
    for (const v of variants) {
        const name = v.name.toUpperCase();
        outputs[`dist/ghost-${v.name}.theme.css`] =
            header(pkg, `Ghost ${name}`, `${pkg.description} ${name} variant.`) +
            body + `\n/* ${name} variant */\n:root:root {\n${v.body}\n}\n`;
    }

    // Refuse to publish CSS that doesn't parse: Discord would silently drop rules.
    for (const [path, css] of Object.entries(outputs)) {
        const errors = validate(css);
        if (errors.length) throw new Error(`${path}:\n  ${errors.join("\n  ")}`);
    }

    await mkdir("dist", { recursive: true });
    await Promise.all(Object.entries(outputs).map(([path, css]) => writeAtomic(path, css)));

    // Plugin: the source folder plus the theme it injects.
    await writeAtomic(join(PLUGIN, "ghost.css"), outputs["dist/ghost.theme.css"]);
    await rm("dist/ghost", { recursive: true, force: true });
    await cp(PLUGIN, "dist/ghost", { recursive: true });
    await Promise.all([
        writeFile("dist/LICENSE", await readFile("LICENSE")),
        writeFile("dist/README.md", await readFile("docs/dist-README.md")),
    ]);

    if (vencord) {
        const target = join(vencord, "src", "userplugins", "ghost");
        await rm(target, { recursive: true, force: true });
        await cp(PLUGIN, target, { recursive: true });
    }
    console.log(`built ${Object.keys(outputs).join(", ")}, dist/ghost/${vencord ? ` → ${join(vencord, "src/userplugins/ghost")}` : ""}`);
}

await build();

if (dev) {
    // Editors often fire several events per save; coalesce them. Ignore our own
    // ghost.css writes in plugin/ghost, or every build would trigger the next.
    let timer;
    const rebuild = (_event, file) => {
        if (file && /ghost\.css(\.tmp)?$/.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => build().catch(err => console.error(err.message)), 50);
    };
    for (const dir of [STYLES, VARIANTS, PLUGIN]) watch(dir, { recursive: true }, rebuild);
    console.log("watching theme/ and plugin/ …");
}
