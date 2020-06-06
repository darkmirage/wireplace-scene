export type ActorID = string;

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type NetworkedAnimationAction = {
  type: number;
  state: number;
};

export type Actor = {
  action: NetworkedAnimationAction;
  actorId: ActorID;
  assetId: number;
  collidable: boolean;
  color: number;
  deleted: boolean;
  movable: boolean;
  position: Vector3;
  revision: number;
  rotation: Vector3;
  scale: Vector3;
  speed: number;
  up: Vector3;
};

export type Update = Partial<Actor>;

export type Diff = {
  v: number;
  d: Record<ActorID, Update>;
};

export type WirePlaceSceneSerialized = Uint8Array;
