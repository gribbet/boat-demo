import type { vec3 } from "gl-matrix";
import type { Properties, View } from "world.ts";
import { createPositionTransition } from "world.ts";

export type FollowViewProperties = {
  enabled: boolean;
  position: vec3 | undefined;
  distance: number;
};

export const createFollowView = (
  properties: Properties<FollowViewProperties>,
) => {
  const { enabled, distance } = properties;

  const position = createPositionTransition(
    () => properties.position() ?? [0, 0, 0],
  );

  return () => {
    if (!enabled()) return {};
    return {
      target: position(),
      offset: [0, 0],
      ...(distance() > 10000 ? { distance: 10000 } : {}),
    } satisfies Partial<View>;
  };
};
