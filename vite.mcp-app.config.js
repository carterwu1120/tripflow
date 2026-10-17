// Builds the MCP Apps card (mcp-app/) into one self-contained HTML file that
// the worker imports as a string and serves as the ui:// resource. Inlining
// everything keeps the card within MCP Apps' default no-network CSP.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = fileURLToPath(new URL("./mcp-app", import.meta.url));

export default defineConfig({
  root,
  plugins: [viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL("./worker/generated", import.meta.url)),
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: { input: `${root}/expenses.html` },
  },
});
