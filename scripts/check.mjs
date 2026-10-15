// CSS syntax check, used by build.mjs (fails the build) and `npm run check`
// (checks the built dist/*.theme.css files). css-tree reports what Chromium would
// drop: unbalanced braces, broken selectors, bad declarations.

import { parse } from "css-tree";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Parse errors in `css`, as "line:column message" strings. */
export function validate(css) {
    const errors = [];
    parse(css, {
        positions: true,
        parseValue: false, // values like rgb(from …) / color-mix() are Chromium's to judge
        onParseError: err => errors.push(`${err.line}:${err.column} ${err.message}`),
    });
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const files = (await readdir("dist")).filter(f => f.endsWith(".theme.css"));
    if (!files.length) throw new Error("no dist/*.theme.css — run npm run build first");
    let failed = false;
    for (const f of files) {
        const errors = validate(await readFile(`dist/${f}`, "utf8"));
        console.log(errors.length ? `✗ ${f}\n  ${errors.join("\n  ")}` : `✓ ${f}`);
        failed ||= errors.length > 0;
    }
    process.exitCode = failed ? 1 : 0;
}
