import { Vector3, Euler, Object3D } from 'three';
import { v4 as uuidv4 } from 'uuid';

// Serialization versioning
const VERSION = 1;

type Actor = {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  up: Vector3;
};

type Update = Partial<Actor>;

type UpdateMap = {
  [actorId: string]: Update;
};

type Diff = {
  v: number,
  d: UpdateMap,
};

class WirePlaceScene {
  _version: number;
  _actors: Record<string, Actor>;
  _updates: Record<string, UpdateMap>;

  constructor() {
    this._version = VERSION;
    this._actors = {};
    this._updates = {};
  }

  _addActor(actorId: string) {
    this._actors[actorId] = new Object3D();
    this._updates[actorId] = {};
  }

  forEach(callback: (actor: Actor) => void) {
    for (const actorId in this._actors) {
      callback(this._actors[actorId]);
    }
  }

  actorExists(actorId: string): boolean {
    return actorId in this._actors;
  }

  getActor(actorId: string): Actor | null {
    return this._actors[actorId] || null;
  }

  registerActor(): string {
    const actorId = uuidv4();
    this._addActor(actorId);
    return actorId;
  }

  removeActor(actorId: string): boolean {
    if (!this.actorExists(actorId)) {
      return false;
    }

    delete this._actors[actorId];
    delete this._updates[actorId];
    return true;
  }

  updateActor(actorId: string, update: Update): boolean {
    if (!this.actorExists(actorId)) {
      return false;
    }

    Object.assign(this._actors[actorId], update);
    for (let listenerId in this._updates) {
      if (!(actorId in this._updates[listenerId])) {
        this._updates[listenerId][actorId] = {};
      }
      Object.assign(this._updates[listenerId][actorId], update);
    }
    return true;
  }

  retrieveDiff(actorId: string): string {
    const updates = this._updates[actorId];
    this._updates[actorId] = {};
    const diff = { v: this._version, d: updates };
    return JSON.stringify(diff);
  }

  applyDiff(data: string) {
    const diff: Diff = JSON.parse(data);
    if (diff.v !== this._version) {
      console.error('Invalid message version received:', diff.v);
      return;
    }

    const updates = diff.d;
    for (const actorId in updates) {
      const update = updates[actorId];
      if (!this.actorExists(actorId)) {
        this._addActor(actorId);
      }
      const actor = this._actors[actorId];

      for (const key in update) {
        const attribute: keyof Update = <any>key;
        Object.assign(actor[attribute], update[attribute]);
      }
    }
  }
}

export default WirePlaceScene;
