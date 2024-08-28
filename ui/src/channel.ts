export type Channel<T> = {
  read: (handler: (data: T) => void) => () => void;
  write: (data: T) => Promise<void>;
  destroy: () => void;
};
