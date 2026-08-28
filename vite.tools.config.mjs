// Bundles one of the tools in src/glassesui/dev for node. They are browser code
// and import the Even SDK, so nothing may be left external — the bundle is run
// from .tools, which has no node_modules beside it.
import { defineConfig } from "vite";

export default defineConfig({
  ssr: { noExternal: true },
  build: {
    ssr: `src/glassesui/dev/${process.env.TOOL}.ts`,
    outDir: ".tools",
    emptyOutDir: true,
    minify: false,
    target: "node22",
  },
});
