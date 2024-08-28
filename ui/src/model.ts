export type Position = [longitude: number, latitude: number, altitude: number];

export type Orientation = [pitch: number, yaw: number, roll: number];

export type State = {
  time: number;
  bootTime: number;
  position: Position;
  orientation: Orientation;
  target: Position;
  path: Position[];
  armed: boolean;
};

export type Vehicle = {
  state: State;
  navigate: (position: Position) => void;
  destroy: () => void;
};
