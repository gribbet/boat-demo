<script lang="ts">
  import { onMount } from "svelte";

  import { createApp } from "../app";
  import type { Vehicle } from "../model";
  import World from "./World.svelte";

  let vehicle: Vehicle | undefined;

  onMount(() => {
    const app = createApp();

    const interval = setInterval(() => {
      ({ vehicle } = app);
    }, 200);

    return () => {
      clearInterval(interval);
      app.destroy();
    };
  });
</script>

<div class="app">
  {#if vehicle}
    <World {vehicle} />
  {/if}
</div>

<style>
  :global(:root) {
    --background: black;
  }

  :global(html) {
    background: var(--background);
    color: white;
    font-size: 16px;
    overscroll-behavior: none;
  }

  :global(body) {
    margin: 0;
    overscroll-behavior: none;
  }

  .app {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
</style>
