import { Readable, Writable } from "node:stream";

import type {
  MavLinkData,
  MavLinkDataConstructor,
  MavLinkPacket,
} from "node-mavlink";
import {
  ardupilotmega,
  common,
  createMavLinkStream,
  MavLinkProtocolV2,
  minimal,
  send as mavlinkSend,
} from "node-mavlink";

import type { Channel } from "./channel";
import { delay } from "./common";

const registry = {
  ...minimal.REGISTRY,
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY,
} as const;

export type Mavlink = Channel<MavLinkData> & {
  receive: <T extends MavLinkData>(
    type: new (...args: unknown[]) => T,
    condition?: (message: T) => boolean,
    cancel?: Promise<never>,
  ) => Promise<T>;
  retry: <T extends MavLinkData>(
    message: MavLinkData,
    received?: Promise<T>,
    cancel?: Promise<never>,
  ) => Promise<T>;
};

export const createMavlink = (channel: Channel<Uint8Array>) => {
  const readable = new Readable({ read: () => [] });
  const reader = createMavLinkStream(readable);

  const read = (handler: (message: MavLinkData) => void) => {
    const packetHandler = (packet: MavLinkPacket) => {
      const { header, protocol, payload } = packet;
      const messageId = header.msgid as unknown as keyof typeof registry;
      const type = registry[messageId];
      if (!type) return;

      const message = protocol.data(payload, type);
      handler(message);
    };
    reader.on("data", packetHandler);
    return () => reader.off("data", packetHandler);
  };

  const destroyRead = channel.read(data => readable.push(data));

  const protocol = new MavLinkProtocolV2(
    255,
    minimal.MavComponent.MISSIONPLANNER,
  );

  const writable = new Writable({
    write: async (data, _, callback) => {
      await channel.write(data);
      callback();
    },
  });

  const write = async (message: MavLinkData) => {
    await mavlinkSend(writable, message, protocol);
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
          unsubscribe = read(message => {
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

  const retry = async <T extends MavLinkData>(
    message: MavLinkData,
    received?: Promise<T>,
    cancel?: Promise<never>,
  ) => {
    const timeout = 500;
    for (let i = 0; ; i++) {
      await write(message);
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

  const destroy = () => {
    destroyRead();
    readable.destroy();
    writable.destroy();
  };

  return {
    read,
    write,
    receive,
    retry,
    destroy,
  } satisfies Mavlink;
};
