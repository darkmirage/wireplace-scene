import { EventEmitter } from 'events';

// Serialization versioning
const VERSION = 1;

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Actor = {
  speed: number;
  color: number;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  up: Vector3;
};

export type Update = Partial<Actor> | false;

export type Diff = {
  v: number;
  d: Record<string, Update>;
};

function createNewActor(): Actor {
  return {
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

  forEach(callback: (actor: Actor) => void) {
    for (const actorId in this._actors) {
      callback(this._actors[actorId]);
    }
  }

  actorExists(actorId: string): boolean {
    return actorId in this._actors;
  }

  removeActor(actorId: string): boolean {
    return this.updateActor(actorId, false);
  }

  updateActor(actorId: string, u: Update): boolean {
    if (!this.actorExists(actorId)) {
      if (!u) {
        return false;
      }

      let obj = createNewActor();
      obj = Object.assign(obj, u);
      this._actors[actorId] = obj;
      this._updates[actorId] = { ...obj };
    } else if (u) {
      Object.assign(this._actors[actorId], u);
      const u_ = this._updates[actorId] || {};
      Object.assign(u_, u);
      this._updates[actorId] = u_;
    } else {
      delete this._actors[actorId];
      delete this._updates[actorId];
      this._updates[actorId] = false;
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
    const data = JSON.stringify(diff);
    const count = Object.keys(updates).length;
    return { count, data };
  }

  applyDiff(data: string, skipId: string | null = null) {
    const diff: Diff = JSON.parse(data);
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
