import { Vector3, Euler, Object3D } from 'three';

// Serialization versioning
const VERSION = 1;

type Actor = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  up: Vector3;
};

type Update = Partial<Actor> | false;

type Diff = {
  v: number,
  d: Record<string, Update>,
};

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
    const obj = new Object3D();
    this._actors[actorId] = obj;
    const { position, rotation, scale, up } = obj;
    this._updates[actorId] = { position, rotation, scale, up };
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
      return false;
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

  retrieveDiff(): { count: number, data: string } {
    const updates = this._updates;
    this._updates = {};
    const diff = { v: this._version, d: updates };
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
