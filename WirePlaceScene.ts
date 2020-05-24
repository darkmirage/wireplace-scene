// Serialization versioning
const VERSION = 1;

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type Actor = {
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
      x: 0,
      y: 0,
      z: 0,
    },
    up: {
      x: 0,
      y: 0,
      z: 0,
    },
  };
}

class WirePlaceScene {
  _version: number;
  _actors: Record<string, Actor>;
  _updates: Record<string, Update>;

  constructor(isMaster: boolean = false) {
    this._version = VERSION;
    this._actors = {};
    this._updates = {};
  }

  addActor(actorId: string) {
    this.updateActor(actorId, {});
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
      return true;
    }

    if (u) {
      Object.assign(this._actors[actorId], u);
      const u_ = this._updates[actorId] || {};
      Object.assign(u_, u);
      this._updates[actorId] = u_;
    } else {
      delete this._actors[actorId];
      delete this._updates[actorId];
      this._updates[actorId] = false;
    }
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

  applyDiff(data: string) {
    const diff: Diff = JSON.parse(data);
    if (diff.v !== this._version) {
      console.error('Invalid message version received:', diff.v);
      return;
    }

    const updates = diff.d;
    for (const actorId in updates) {
      const u = updates[actorId];
      this.updateActor(actorId, u);
    }
  }
}

export default WirePlaceScene;
