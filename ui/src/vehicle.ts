import type { MavLinkData, MavLinkDataConstructor } from "node-mavlink";
import { ardupilotmega, common, minimal } from "node-mavlink";

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
  MavMissionType,
  StatusText,
  MavFrame,
  MavMissionResult,
  MavResult,
} = common;
const { RoverMode } = ardupilotmega;
const { Heartbeat } = minimal;

export const createVehicle = (mavlink: Mavlink) => {
  const state: State = {
    time: Date.now(),
    bootTime: 0,
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

    if ("timeBootMs" in message && typeof message.timeBootMs === "number")
      state.bootTime = message.timeBootMs;
  });

  const heartbeat = async () => {
    const message = new minimal.Heartbeat();
    message.type = minimal.MavType.GCS;
    message.autopilot = minimal.MavAutopilot.INVALID;
    message.systemStatus = minimal.MavState.ACTIVE;
    await mavlink.write(message);
  };

  const receive = async <T extends MavLinkData>(
    type: new (...args: unknown[]) => T,
    condition?: (message: T) => boolean,
    cancel?: Promise<never>,
  ) => {
    let unsubscribe: (() => void) | undefined;
    try {
      return await Promise.race([
        new Promise<T>(resolve => {
          unsubscribe = mavlink.read(message => {
            if (message instanceof type && (!condition || condition(message)))
              resolve(message);
          });
        }),
        ...(cancel ? [cancel] : []),
      ]);
    } finally {
      unsubscribe?.();
    }
  };

  const sendAndReceive = async <T extends MavLinkData>(
    message: MavLinkData,
    received?: Promise<T>,
    cancel?: Promise<never>,
  ) => {
    const timeout = 500;
    for (let i = 0; ; i++) {
      await mavlink.write(message);
      const wait = Math.min(10000, timeout * 1.25 ** i);
      const result = await Promise.race([
        received,
        delay(wait),
        ...(cancel ? [cancel] : []),
      ]);
      if (result) return result;
      const type = (message.constructor as MavLinkDataConstructor<MavLinkData>)
        .MSG_NAME;
      console.log("Retry", { type });
    }
  };

  const sendCommand = async (
    message: common.CommandLong | common.CommandInt,
    cancel?: Promise<never>,
  ) => {
    const result = await sendAndReceive(
      message,
      receive(common.CommandAck, _ => _.command === message.command),
      cancel,
    );
    if (result.result !== MavResult.ACCEPTED)
      console.warn("Command failure", result);
  };
  const navigate = async ([longitude, latitude]: Position) => {
    const message = new CommandInt();
    message.targetComponent = 0;
    message.command = MavCmd.DO_REPOSITION;
    message._param1 = -1;
    message._param2 = MavDoRepositionFlags.CHANGE_MODE;
    message._param5 = latitude * 1e7;
    message._param6 = longitude * 1e7;
    message._param7 = 0;
    await sendCommand(message);
  };

  const arm = async () => {
    const message = new CommandLong();
    message.targetComponent = 0;
    message.command = MavCmd.COMPONENT_ARM_DISARM;
    message._param1 = 1;
    await sendCommand(message);
  };

  const disarm = async ({ force }: { force?: boolean } = {}) => {
    const message = new CommandLong();
    message.command = MavCmd.COMPONENT_ARM_DISARM;
    message._param2 = force ? 21196 : 0;
    await sendCommand(message);
  };

  const auto = async () => {
    const message = new CommandLong();
    message.command = MavCmd.DO_SET_MODE;
    message._param1 = 1;
    message._param2 = RoverMode.AUTO;
    await sendCommand(message);
  };

  const reboot = async () => {
    if (state.armed) await disarm({ force: true });
    const message = new CommandLong();
    message.command = MavCmd.PREFLIGHT_REBOOT_SHUTDOWN;
    message._param1 = 1;
    await sendCommand(message);
  };

  const missionCount = async (count: number, cancel?: Promise<never>) => {
    const message = new common.MissionCount();
    message.targetComponent = 0;
    message.count = count;
    message.missionType = MavMissionType.MISSION;

    await sendAndReceive(
      message,
      receive(common.MissionRequest, _ => _.seq === 0),
      cancel,
    );
  };

  const writeMission = async (
    waypoints: Position[],
    cancel?: Promise<never>,
  ) => {
    const items = waypoints.map(([lng, lat, alt], i) => {
      const item = new common.MissionItemInt();
      item.targetComponent = 0;
      item.seq = i;
      item.frame = MavFrame.GLOBAL_RELATIVE_ALT;
      item.command = MavCmd.NAV_WAYPOINT;
      item.param1 = 0;
      item.param2 = 0;
      item.param3 = 0;
      item.param4 = 0;
      item.x = lat * 1e7;
      item.y = lng * 1e7;
      item.z = alt;
      return item;
    });

    console.log(`Writing mission with ${items.length} waypoints`);

    await missionCount(items.length, cancel);

    const complete = receive(
      common.MissionAck,
      _ => _.type !== MavMissionResult.INVALID_SEQUENCE,
      cancel,
    );

    await Promise.all(
      items.map(async (item, i) => {
        console.log(`Sending mission item ${item.seq}`);
        const last = i === items.length - 1;
        const missionRequest = (seq: number) =>
          Promise.race([
            receive(common.MissionRequest, _ => _.seq === seq),
            complete,
          ]);
        if (last) await missionRequest(i);

        await sendAndReceive(
          item,
          Promise.race([complete, last ? complete : missionRequest(i + 1)]),
          cancel,
        );
        console.log(`Sent mission item ${i}`);
      }),
    );

    const ack = await complete;

    if (ack.type !== MavMissionResult.ACCEPTED) {
      console.warn(
        `Mission write failure: ${MavMissionResult[ack.type]}. Retrying`,
      );
      return;
    }

    console.log("Mission write complete");
  };

  const start = async () => {
    await writeMission([
      [25.67776, -77.797865, 0],
      [25.67876, -77.797865, 0],
      [25.67976, -77.797965, 0],
      [25.67076, -77.797965, 0],
    ]);
    await arm();
    await auto();
  };

  let rebooted = false;
  let started = false;
  const step = async () => {
    await heartbeat();
    state.path.unshift(state.position);
    if (state.path.length > 10000) state.path.length = 10000;

    if (state.bootTime > 10 * 60 * 60 * 1000 && state.armed && !rebooted) {
      rebooted = true;
      await reboot();
      state.bootTime = 0;
    }

    if (!state.armed && !started) {
      started = true;
      await start();
    }
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
