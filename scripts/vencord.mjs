// Day-to-day helpers for running Ghost in a Vencord source checkout (the
// userplugin setup), so updating doesn't mean juggling two folders.
//
//   node scripts/vencord.mjs deploy   build Ghost into Vencord, build Vencord   (npm run deploy)
//   node scripts/vencord.mjs watch    the same on every save                    (npm run dev:discord)
//   node scripts/vencord.mjs update   git pull + install + build Vencord, then deploy (npm run vencord:update)
//   node scripts/vencord.mjs inject   Vencord's installer: patch Discord again   (npm run vencord:inject)
//
// The checkout is ../Vencord, or VENCORD_DIR. Discord picks up a new build on
// Ctrl+R; only `inject` needs Discord closed.

import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { resolve } from "node:path";

const vencord = resolve(process.env.VENCORD_DIR ?? "../Vencord");
const command = process.argv[2];

if (!existsSync(resolve(vencord, "package.json"))) {
    console.error(`No Vencord checkout at ${vencord}. Clone it there, or set VENCORD_DIR.`);
    process.exit(1);
}

/** Run a command, inheriting the terminal; resolves on exit code 0. shell: true
 *  because pnpm is a .cmd shim on Windows. */
function run(cmd, args, cwd = process.cwd()) {
    return new Promise((done, fail) => {
        console.log(`\n> ${cmd} ${args.join(" ")}${cwd === process.cwd() ? "" : `   (in ${cwd})`}`);
        const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
        child.on("exit", code => (code === 0 ? done() : fail(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))));
    });
}

async function deploy() {
    await run("node", ["build.mjs", "--vencord", JSON.stringify(vencord)]);
    await run("pnpm", ["build"], vencord);
    console.log("\nDone. Press Ctrl+R in Discord to load it.");
}

const commands = {
    deploy,

    async watch() {
        // Not Vencord's own `pnpm watch`: its loader for ?managed CSS doesn't
        // register the file with esbuild's watcher, so theme-only changes never
        // rebuilt. A full deploy takes a couple of seconds; run one per burst
        // of saves, never two at once.
        let running = false;
        let again = false;
        let timer;
        const redeploy = async () => {
            if (running) return void (again = true);
            running = true;
            try {
                await deploy();
            } catch (err) {
                console.error(`\n${err.message}`);
            }
            running = false;
            if (again) {
                again = false;
                redeploy();
            }
        };
        const onChange = (_event, file) => {
            // build.mjs writes plugin/ghost/ghost.css itself, which also reports
            // a change of the folder "ghost"; reacting to either would loop.
            if (file && /^ghost$|ghost\.css(\.tmp)?$/.test(file)) return;
            clearTimeout(timer);
            timer = setTimeout(redeploy, 150);
        };
        for (const dir of ["theme", "plugin"]) watch(dir, { recursive: true }, onChange);
        await redeploy();
        console.log("Watching theme/ and plugin/. Ctrl+C to stop.");
    },

    async update() {
        await run("git", ["pull", "--ff-only"], vencord);
        await run("pnpm", ["install", "--frozen-lockfile"], vencord);
        await deploy();
    },

    async inject() {
        console.log("Close Discord first (also from the tray); the installer patches it again.");
        await run("pnpm", ["inject"], vencord);
    },
};

if (!commands[command]) {
    console.error(`Usage: node scripts/vencord.mjs <${Object.keys(commands).join("|")}>`);
    process.exit(1);
}

try {
    await commands[command]();
} catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
}
