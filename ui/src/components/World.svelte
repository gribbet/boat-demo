<script lang="ts">
  import { onMount } from "svelte";

  import type { Vehicle } from "../model";
  import type { World } from "../world";
  import { createWorld } from "../world";

  export let vehicle: Vehicle;

  let element: HTMLCanvasElement | undefined;
  let world: World | undefined;

  $: ({ state } = vehicle);

  onMount(() => {
    if (!element) return;

    world = createWorld(element, {
      state: () => state,
      onTarget: vehicle.navigate,
    });

    return () => world?.dispose();
  });
</script>

<canvas bind:this={element} />

<style>
  canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
</style>
