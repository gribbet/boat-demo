import type { vec4 } from "gl-matrix";
import { quat } from "gl-matrix";
import type { Context, Mesh, Properties } from "world.ts";
import {
  createContainer,
  createObjectLayer,
  createOrientationTransition,
  createPositionVelocityTransition,
  degrees,
} from "world.ts";

import type { State } from "../model";
import { loadObj } from "./obj";
import { createStemLayer } from "./stem";

const vehicleObj = new URL("./boat.obj", import.meta.url).toString();
const vehicleOutlineObj = new URL(
  "./boat-outline.obj",
  import.meta.url,
).toString();

export type VehicleLayerProperties = {
  state: State | undefined;
  onClick: () => void;
};

export const createVehicleLayer = (
  context: Context,
  properties: Properties<VehicleLayerProperties>,
) => {
  const { state, onClick } = properties;

  const size = 1;
  const minSizePixels = 32;

  let vehicleMesh: Mesh | undefined;
  let vehicleOutlineMesh: Mesh | undefined;

  const position = createPositionVelocityTransition(
    () => state()?.position ?? [0, 0, 0],
  );
  const _orientation = createOrientationTransition(
    () => state()?.orientation ?? [0, 0, 0],
  );
  const orientation = () => {
    const [pitch = 0, yaw = 0, roll = 0] = _orientation();
    return quat.fromEuler(
      quat.create(),
      -degrees(pitch),
      degrees(roll),
      degrees(yaw),
    );
  };
  const color = () => [1, 1, 1, 1] satisfies vec4;

  const vehicle = createObjectLayer(context, {
    mesh: () => vehicleMesh,
    position,
    orientation,
    size: () => size,
    minSizePixels: () => minSizePixels,
    color,
    diffuse: color,
    polygonOffset: () => -1100,
    onClick,
  });
  const vehicleOutline = createObjectLayer(context, {
    mesh: () => vehicleOutlineMesh,
    position,
    orientation,
    size: () => size,
    minSizePixels: () => minSizePixels,
    color: () => [0, 0, 0, 1],
    pickable: () => false,
    polygonOffset: () => -1000,
  });
  const stem = createStemLayer(context, {
    position,
    color: () => [1, 1, 1, 1],
  });

  const load = async () => {
    vehicleMesh = await loadObj(vehicleObj);
    vehicleOutlineMesh = await loadObj(vehicleOutlineObj);
  };

  void load();

  return createContainer([vehicle, vehicleOutline, stem]);
};
