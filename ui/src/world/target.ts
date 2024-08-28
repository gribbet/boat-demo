import type { vec3, vec4 } from "gl-matrix";
import type { Context, Properties } from "world.ts";
import {
  createBillboardLayer,
  createContainer,
  createPositionTransition,
} from "world.ts";

import { createStemLayer } from "./stem";

export type TargetLayerProperties = {
  position: vec3;
};

export const createTargetLayer = (
  context: Context,
  properties: Properties<TargetLayerProperties>,
) => {
  const position = createPositionTransition(properties.position);

  const color = () => [0.34, 0.56, 1, 1] satisfies vec4;

  return createContainer([
    createBillboardLayer(context, {
      url: () => new URL("marker.png", import.meta.url).toString(),
      position,
      size: () => 1000,
      minSizePixels: () => 8,
      maxSizePixels: () => 24,
      color,
      polygonOffset: () => -10000,
    }),
    createStemLayer(context, {
      position,
      color,
    }),
  ]);
};
