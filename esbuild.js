const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  // Build extension (Node.js)
  const extensionCtx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "warning",
    plugins: [esbuildProblemMatcherPlugin],
  });

  // Build webview scripts (browser)
  const webviewCtx = await esbuild.context({
    entryPoints: [
      "src/webview/client/preview.ts",
      "src/webview/client/upload-widget.ts",
      "src/webview/client/welcome.ts",
    ],
    bundle: true,
    format: "iife",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "browser",
    outdir: "media/scripts",
    logLevel: "warning",
  });

  if (watch) {
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
