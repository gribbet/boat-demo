import { ardupilotmega, common, minimal } from "node-mavlink";

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

  const sendCommand = async (
    message: common.CommandLong | common.CommandInt,
    cancel?: Promise<never>,
  ) => {
    const result = await mavlink.retry(
      message,
      mavlink.receive(common.CommandAck, _ => _.command === message.command),
      cancel,
    );
    if (result.result !== MavResult.ACCEPTED)
      console.warn("Command failure", result);
  };
  const navigate = async ([longitude, latitude, altitude]: Position) => {
    const message = new CommandInt();
    message.targetComponent = 0;
    message.command = MavCmd.DO_REPOSITION;
    message._param1 = -1;
    message._param2 = MavDoRepositionFlags.CHANGE_MODE;
    message._param5 = latitude * 1e7;
    message._param6 = longitude * 1e7;
    message._param7 = altitude;
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

    await mavlink.retry(
      message,
      mavlink.receive(common.MissionRequest, _ => _.seq === 0),
      cancel,
    );
  };

  const writeMission = async (
    waypoints: Position[],
    cancel?: Promise<never>,
  ) => {
    const [home] = waypoints;
    if (!home) return;
    const points = [home, ...waypoints].map(
      ([longitude, latitude, altitude], i) => {
        const item = new common.MissionItemInt();
        item.seq = i;
        item.frame = MavFrame.GLOBAL_RELATIVE_ALT;
        item.command = MavCmd.NAV_WAYPOINT;
        item.x = latitude * 1e7;
        item.y = longitude * 1e7;
        item.z = altitude;
        return item;
      },
    );
    const reset = new common.MissionItemInt();
    reset.seq = points.length;
    reset.frame = MavFrame.GLOBAL_RELATIVE_ALT;
    reset.command = MavCmd.DO_JUMP;
    reset.param1 = 1;
    reset.param2 = -1;
    const items = [...points, reset];

    console.log(`Writing mission with ${items.length} waypoints`);

    await missionCount(items.length, cancel);

    const complete = mavlink.receive(
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
            mavlink.receive(common.MissionRequest, _ => _.seq === seq),
            complete,
          ]);
        if (last) await missionRequest(i);

        await mavlink.retry(
          item,
          Promise.race([complete, last ? complete : missionRequest(i + 1)]),
          cancel,
        );
        console.log(`Sent mission item ${i}`);
      }),
    );

    const ack = await complete;

    if (ack.type !== MavMissionResult.ACCEPTED) {
      console.warn(`Mission write failure: ${MavMissionResult[ack.type]}`);
      return;
    }

    console.log("Mission write complete");
  };

  const setMissionCurrent = async (index: number) => {
    const message = new CommandLong();
    message.command = MavCmd.DO_SET_MISSION_CURRENT;
    message._param1 = index;
    message._param2 = 1; // Reset mission

    await sendCommand(message);
  };

  const start = async () => {
    await writeMission([
      [-77.79155, 25.68001, 0],
      [-77.78964, 25.67868, 0],
      [-77.78943, 25.67889, 0],
      [-77.79144, 25.68022, 0],
      [-77.79129, 25.6806, 0],
      [-77.78928, 25.67926, 0],
      [-77.78919, 25.67953, 0],
      [-77.79102, 25.68063, 0],
    ]);
    await setMissionCurrent(0);
    if (!state.armed) await arm();
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

    if (!started) {
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
