export type ActorID = string;

export type WirePlaceVector3 = {
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
  position: WirePlaceVector3;
  revision: number;
  rotation: WirePlaceVector3;
  scale: WirePlaceVector3;
  speed: number;
  up: WirePlaceVector3;
};

export type Update = Partial<Actor>;

export type Diff = {
  v: number;
  d: Record<ActorID, Update>;
};

export type WirePlaceSceneSerialized = Uint8Array;
