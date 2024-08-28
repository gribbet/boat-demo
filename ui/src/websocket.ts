import type { Channel } from "./channel";
import { delay, signal } from "./common";
import { createSubscriber } from "./subscriber";

export const createWebSocketChannel = (url: string) => {
  let running = true;
  let socket: WebSocket | undefined;
  const [closed, onClose] = signal();
  const { subscribe: read, emit } = createSubscriber<Uint8Array>();

  const run = async () => {
    const connect = async () => {
      const tryConnect = async () =>
        await new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(url);
          socket.binaryType = "arraybuffer";
          socket.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
            emit(new Uint8Array(data));
          };
          socket.onerror = () => {
            reject(new Error("Could not connect"));
          };
          socket.onopen = () => resolve(socket);
        });

      while (running)
        try {
          socket = await tryConnect();
          socket.onclose = () => connect();
          return;
        } catch (error) {
          console.warn("Connection failure", error);
          await delay(1000);
        }
    };

    await connect();
    await closed;
    socket?.close();
  };

  const write = (data: Uint8Array) => {
    socket?.send(data);
    return delay();
  };

  const destroy = () => {
    running = false;
    onClose();
  };

  void run();

  return {
    write,
    read,
    destroy,
  } satisfies Channel<Uint8Array>;
};
