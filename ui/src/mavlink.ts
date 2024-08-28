import { Readable, Writable } from "node:stream";

import type { MavLinkData, MavLinkPacket } from "node-mavlink";
import {
  ardupilotmega,
  common,
  createMavLinkStream,
  MavLinkProtocolV2,
  minimal,
  send as mavlinkSend,
} from "node-mavlink";

import type { Channel } from "./channel";

const registry = {
  ...minimal.REGISTRY,
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY,
} as const;

export type Mavlink = Channel<MavLinkData>;

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

  const destroy = () => {
    destroyRead();
    readable.destroy();
    writable.destroy();
  };

  return {
    read,
    write,
    destroy,
  } satisfies Mavlink;
};
