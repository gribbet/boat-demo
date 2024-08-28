import { endpoint } from "./configuration";
import { createMavlink } from "./mavlink";
import type { Vehicle } from "./model";
import { createVehicle } from "./vehicle";
import { createWebSocketChannel } from "./websocket";

export type App = {
  vehicle: Vehicle;
  destroy: () => void;
};

export const createApp = () => {
  const vehicle = createVehicle(
    createMavlink(createWebSocketChannel(endpoint)),
  );

  const { destroy } = vehicle;

  return {
    get vehicle() {
      return vehicle;
    },
    destroy,
  } satisfies App;
};
