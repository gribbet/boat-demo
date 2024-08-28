import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import environment from "vite-plugin-environment";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  root: "src",
  plugins: [
    environment({
      VITE_ENDPOINT: "",
    }),
    svelte({
      preprocess: vitePreprocess(),
    }),
    nodePolyfills({
      exclude: ["crypto"],
    }),
  ],
  build: {
    outDir: "../dist",
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: {
        index: "./src/index.html",
        "service-worker": "./src/service-worker.ts",
      },
      output: {
        entryFileNames: assetInfo =>
          assetInfo.name === "service-worker"
            ? "service-worker.js"
            : "assets/[name]-[hash].js",
      },
    },
  },
});
