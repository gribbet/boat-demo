import type { vec3, vec4 } from "gl-matrix";
import type { Context, Properties } from "world.ts";
import { cache, createLineLayer } from "world.ts";

export type StemLayerProperties = {
  position: vec3;
  color: vec4;
};

export const createStemLayer = (
  context: Context,
  properties: Properties<StemLayerProperties>,
) => {
  const { position, color } = properties;
  return createLineLayer(context, {
    points: cache(position, ([lng = 0, lat = 0, alt = 0]) => [
      [
        [lng, lat, alt],
        [lng, lat, 0],
      ],
    ]),
    color,
    minWidthPixels: () => 3,
    maxWidthPixels: () => 3,
    pickable: () => false,
  });
};
