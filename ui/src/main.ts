/// <reference types="vite/client" />

import process from "process";

import App from "./components/App.svelte";
import { endpoint } from "./configuration";

window.process = process;

console.log("Endpoint", endpoint);

window.addEventListener("load", () =>
  navigator.serviceWorker.register(
    import.meta.env.PROD
      ? "./service-worker.js"
      : new URL("./service-worker", import.meta.url),
    { type: "module" },
  ),
);

new App({
  target: document.body,
});
