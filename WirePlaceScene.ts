import { EventEmitter } from 'events';

// Serialization versioning
const VERSION = 1;

console.log('[Scene] Version:', VERSION);

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Actor = {
  actorId: string;
  deleted: boolean;
  speed: number;
  color: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  up: Vector3;
};

export type Update = Partial<Actor>;

export type Diff = {
  v: number;
  d: Record<string, Update>;
};

export type WirePlaceSceneSerialized = string;

function createNewActor(actorId: string): Actor {
  return {
    actorId,
    deleted: false,
    speed: 1.4,
    color: 0,
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    scale: {
      x: 1.0,
      y: 1.0,
      z: 1.0,
    },
    up: {
      x: 0,
      y: 1.0,
      z: 0,
    },
  };
}

function serializeDiff(diff: Diff): WirePlaceSceneSerialized {
  return JSON.stringify(diff);
}

function deserializeDiff(data: WirePlaceSceneSerialized): Diff {
  return JSON.parse(data);
}

class WirePlaceScene extends EventEmitter {
  _version: number;
  _actors: Record<string, Actor>;
  _updates: Record<string, Update>;

  constructor(isMaster: boolean = false) {
    super();
    this._version = VERSION;
    this._actors = {};
    this._updates = {};
  }

  clear() {
    this.forEach((actor, actorId) => this.removeActor(actorId));
  }

  onActorUpdate(
    actorId: string,
    callback: (update: Update, actor: Actor) => void
  ): () => void {
    this.on(actorId, callback);
    return () => {
      this.off(actorId, callback);
    };
  }

  addActor(actorId: string) {
    this.updateActor(actorId, {});
  }

  getActor(actorId: string): Actor | null {
    return this._actors[actorId] || null;
  }

  forEach(callback: (actor: Actor, actorId: string) => void) {
    for (const actorId in this._actors) {
      callback(this._actors[actorId], actorId);
    }
  }

  actorExists(actorId: string): boolean {
    return actorId in this._actors;
  }

  removeActor(actorId: string): boolean {
    return this.updateActor(actorId, { deleted: true });
  }

  updateActor(actorId: string, u: Update): boolean {
    const exists = this.actorExists(actorId);

    if (!exists && u.deleted) {
      return false;
    }

    if (!exists) {
      let obj = createNewActor(actorId);
      obj = Object.assign(obj, u);
      this._actors[actorId] = obj;
      this._updates[actorId] = { ...obj };

      this.emit(actorId, u, this.getActor(actorId));
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

    this.emit(actorId, u, this.getActor(actorId));
    return true;
  }

  retrieveDiff(getAll: boolean = false): Diff {
    if (getAll) {
      const updates = this._actors;
      return { v: this._version, d: updates };
    } else {
      const updates = this._updates;
      this._updates = {};
      return { v: this._version, d: updates };
    }
  }

  retrieveSerializedDiff(
    getAll: boolean = false
  ): { count: number; data: string } {
    const diff = this.retrieveDiff(getAll);
    const updates = diff.d;
    const data = serializeDiff(diff);
    const count = Object.keys(updates).length;
    return { count, data };
  }

  applyDiff(data: WirePlaceSceneSerialized, skipId: string | null = null) {
    const diff = deserializeDiff(data);
    if (diff.v !== this._version) {
      console.error('Invalid message version received:', diff.v);
      return;
    }

    const updates = diff.d;
    for (const actorId in updates) {
      if (skipId && skipId === actorId) {
        continue;
      }
      const u = updates[actorId];
      this.updateActor(actorId, u);
    }
  }
}

export default WirePlaceScene;
