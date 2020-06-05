import { EventEmitter } from 'events';

import {
  Actor,
  ActorID,
  Diff,
  Update,
  WirePlaceSceneSerialized,
} from './types';
import { createNewActor, serializeDiff, deserializeDiff } from './utils';

// Serialization versioning
const VERSION = 5;

export interface IScene<T> {
  version: number;

  addActor(actorId: ActorID): void;
  clear(): void;
  getActor(actorId: ActorID): Actor | null;
  getActorOrThrow(actorId: ActorID): Actor;
  removeActor(actorId: ActorID): boolean;
  updateActor(actorId: ActorID, u: Update, invokeCallbacks?: boolean): boolean;

  onActorUpdate(
    actorId: ActorID,
    callback: (update: Update, actor: Actor) => void
  ): () => void;

  applyDiff(diff: Diff): void;
  applySerializedDiff(data: T): void;
  retrieveDiff(getAll?: boolean): Diff;
  retrieveSerializedDiff(getAll: boolean): { count: number; data: T };
}

class WirePlaceScene extends EventEmitter
  implements IScene<WirePlaceSceneSerialized> {
  version: number;
  _actors: Record<ActorID, Actor>;
  _updates: Record<ActorID, Update>;

  constructor() {
    super();
    this.version = VERSION;
    this._actors = {};
    this._updates = {};
  }

  clear() {
    this.forEach((actor, actorId) => this.removeActor(actorId));
  }

  onActorUpdate(
    actorId: ActorID,
    callback: (update: Update, actor: Actor) => void
  ): () => void {
    this.on(actorId, callback);
    return () => {
      this.off(actorId, callback);
    };
  }

  addActor(actorId: ActorID) {
    this.updateActor(actorId, {});
  }

  getActor(actorId: ActorID): Actor | null {
    return this._actors[actorId] || null;
  }

  getActorOrThrow(actorId: ActorID): Actor {
    const actor = this.getActor(actorId);
    if (actor) {
      return actor;
    }
    throw new Error(`Invalid actorId: ${actorId}`);
  }

  forEach(callback: (actor: Actor, actorId: ActorID) => void) {
    for (const actorId in this._actors) {
      callback(this._actors[actorId], actorId);
    }
  }

  actorExists(actorId: ActorID): boolean {
    return actorId in this._actors;
  }

  removeActor(actorId: ActorID): boolean {
    return this.updateActor(actorId, { deleted: true });
  }

  updateActor(
    actorId: ActorID,
    u: Update,
    invokeCallbacks: boolean = false
  ): boolean {
    const exists = this.actorExists(actorId);

    if (!exists && u.deleted) {
      return false;
    }

    if (!exists) {
      let obj = createNewActor(actorId);
      obj = Object.assign(obj, u);
      this._actors[actorId] = obj;
      this._updates[actorId] = { ...obj };

      if (invokeCallbacks) {
        this.emit(actorId, u, this.getActor(actorId));
      }
      return true;
    }

    if (u.deleted) {
      delete this._actors[actorId];
      delete this._updates[actorId];
      this._updates[actorId] = { deleted: true };
    } else {
      Object.assign(this._actors[actorId], u);
      const u_ = this._updates[actorId] || {};
      Object.assign(u_, u);
      this._updates[actorId] = u_;
    }

    if (invokeCallbacks) {
      this.emit(actorId, u, this.getActor(actorId));
    }
    return true;
  }

  retrieveDiff(getAll: boolean = false): Diff {
    if (getAll) {
      const updates = this._actors;
      return { v: this.version, d: updates };
    } else {
      const updates = this._updates;
      this._updates = {};
      return { v: this.version, d: updates };
    }
  }

  retrieveSerializedDiff(
    getAll: boolean = false
  ): { count: number; data: WirePlaceSceneSerialized } {
    const diff = this.retrieveDiff(getAll);
    const updates = diff.d;
    const data = serializeDiff(diff);
    const count = Object.keys(updates).length;
    return { count, data };
  }

  applyDiff(diff: Diff) {
    if (diff.v !== this.version) {
      console.error('Invalid message version received:', diff.v);
      return;
    }

    const updates = diff.d;
    for (const actorId in updates) {
      const u = updates[actorId];
      this.updateActor(actorId, u);
    }
  }

  applySerializedDiff(data: WirePlaceSceneSerialized) {
    const diff = deserializeDiff(data);
    return this.applyDiff(diff);
  }
}

export default WirePlaceScene;
