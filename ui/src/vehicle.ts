import { common, minimal } from "node-mavlink";

import { delay } from "./common";
import type { Mavlink } from "./mavlink";
import type { Position, State, Vehicle } from "./model";

const {
  MavCmd,
  MavDoRepositionFlags,
  GlobalPositionInt,
  CommandLong,
  Attitude,
  PositionTargetGlobalInt,
  CommandInt,
  StatusText,
} = common;
const { Heartbeat } = minimal;

export const createVehicle = (mavlink: Mavlink) => {
  const state: State = {
    time: Date.now(),
    position: [0, 0, 0],
    orientation: [0, 0, 0],
    target: [0, 0, 0],
    path: [],
    armed: false,
  };

  const unsubscribe = mavlink.read(message => {
    state.time = Date.now();
    if (message instanceof GlobalPositionInt) {
      const latitude = message.lat / 1e7;
      const longitude = message.lon / 1e7;
      const altitude = message.alt / 1e3;
      state.position = [longitude, latitude, altitude];
    } else if (message instanceof Attitude) {
      const { pitch, yaw, roll } = message;
      state.orientation = [pitch, yaw, roll];
    } else if (message instanceof PositionTargetGlobalInt) {
      const latitude = message.latInt / 1e7;
      const longitude = message.lonInt / 1e7;
      const altitude = message.alt;
      state.target = [longitude, latitude, altitude];
    } else if (message instanceof Heartbeat)
      state.armed = !!(message.baseMode & minimal.MavModeFlag.SAFETY_ARMED);
    else if (message instanceof StatusText) console.log(message.text);
  });

  const heartbeat = async () => {
    const message = new minimal.Heartbeat();
    message.type = minimal.MavType.GCS;
    message.autopilot = minimal.MavAutopilot.INVALID;
    message.systemStatus = minimal.MavState.ACTIVE;
    await mavlink.write(message);
  };

  const navigate = async ([longitude, latitude]: Position) => {
    if (!state.armed) {
      await arm();
      await delay(1000);
    }
    const message = new CommandInt();
    message.targetComponent = 0;
    message.command = MavCmd.DO_REPOSITION;
    message._param1 = -1;
    message._param2 = MavDoRepositionFlags.CHANGE_MODE;
    message._param5 = latitude * 1e7;
    message._param6 = longitude * 1e7;
    message._param7 = 0;
    await mavlink.write(message);
  };

  const arm = async () => {
    const message = new CommandLong();
    message.targetComponent = 0;
    message.command = MavCmd.COMPONENT_ARM_DISARM;
    message._param1 = 1;
    await mavlink.write(message);
  };

  const step = async () => {
    await heartbeat();
    state.path.unshift(state.position);
    if (state.path.length > 10000) state.path.length = 10000;
  };

  const interval = setInterval(step, 200);

  const destroy = () => {
    clearInterval(interval);
    unsubscribe();
  };

  return {
    get state() {
      return state;
    },
    navigate,
    destroy,
  } satisfies Vehicle;
};
