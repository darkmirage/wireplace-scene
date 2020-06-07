import { EventEmitter } from 'events';

import {
  Actor,
  ActorID,
  Diff,
  Update,
  WirePlaceSceneSerialized,
} from './types';
import {
  createNewActor,
  serializeDiff,
  deserializeDiff,
  deserializeID,
} from './serialization';

// Serialization versioning
const VERSION = 7;

const REV_BUFFER = 200;
const MAX_REV = 2000;

export interface IScene<T> {
  version: number;

  clear(): void;
  getActor(actorId: ActorID): Actor | null;
  getActorOrThrow(actorId: ActorID): Actor;
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

export interface IMasterScene<T> extends IScene<T> {
  addActor(actorId: ActorID): void;
  removeActor(actorId: ActorID): boolean;
  nextActorID(): ActorID;
}

export function isRevisionNewer(currentRev: number, newRev: number): boolean {
  if (currentRev >= MAX_REV - REV_BUFFER && newRev < REV_BUFFER) {
    currentRev = 0;
  }
  return newRev > currentRev;
}

class WirePlaceScene extends EventEmitter
  implements IMasterScene<WirePlaceSceneSerialized> {
  version: number;
  _actors: Record<ActorID, Actor>;
  _updates: Record<ActorID, Update>;
  _nextId: number;

  constructor() {
    super();
    this.version = VERSION;
    this._actors = {};
    this._updates = {};
    this._nextId = 0;
  }

  clear() {
    this.forEach((actor, actorId) => this.removeActor(actorId));
  }

  nextActorID(): ActorID {
    const actorId = deserializeID(this._nextId);
    this._nextId += 1;
    return actorId;
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

  removeActor(actorId: ActorID): boolean {
    return this.updateActor(actorId, { deleted: true });
  }

  updateActor(
    actorId: ActorID,
    u: Update,
    invokeCallbacks: boolean = false
  ): boolean {
    const actor = this.getActor(actorId);

    if (!actor && u.deleted) {
      return false;
    }

    if (!actor) {
      let obj = createNewActor(actorId);
      obj = Object.assign(obj, u);
      this._actors[actorId] = obj;
      this._updates[actorId] = { ...obj };

      if (invokeCallbacks) {
        this.emit(actorId, u, this.getActor(actorId));
      }
      return true;
    }

    let currentRev = actor.revision;
    let newRev = u.revision;

    if (newRev !== undefined) {
      if (!isRevisionNewer(currentRev, newRev)) {
        return false;
      }
    } else {
      u.revision = (currentRev + 1) % MAX_REV;
    }

    if (u.deleted) {
      delete this._actors[actorId];
      delete this._updates[actorId];
      this._updates[actorId] = { deleted: true };
    } else {
      Object.assign(actor, u);
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
