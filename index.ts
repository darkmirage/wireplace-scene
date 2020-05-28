import WirePlaceScene, {
  serializeDiff,
  deserializeDiff,
} from './WirePlaceScene';

export type {
  Actor,
  ActorID,
  Update,
  Diff,
  WirePlaceSceneSerialized,
} from './WirePlaceScene';

export { WirePlaceScene, deserializeDiff, serializeDiff };
