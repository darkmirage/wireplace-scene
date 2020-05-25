import { EventEmitter } from 'events';
import { flatbuffers } from 'flatbuffers';
import { WPFlatbuffers } from './flatbuffers/WirePlaceFlatBuffers_generated';

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
  assetId: number;
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

export type WirePlaceSceneSerialized = Uint8Array;

function createNewActor(actorId: string): Actor {
  return {
    actorId,
    deleted: false,
    speed: 1.4,
    color: 0,
    assetId: 0,
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

export function serializeDiff(diff: Diff): WirePlaceSceneSerialized {
  const builder = new flatbuffers.Builder();

  const uFBs = Object.keys(diff.d).map((actorId) => {
    const u = diff.d[actorId];
    const idFB = builder.createString(actorId);

    WPFlatbuffers.Update.startUpdate(builder);
    WPFlatbuffers.Update.addActorId(builder, idFB);
    if (u.color !== undefined) {
      WPFlatbuffers.Update.addColor(
        builder,
        WPFlatbuffers.UShort.createUShort(builder, u.color)
      );
    }
    if (u.assetId !== undefined) {
      WPFlatbuffers.Update.addAssetId(
        builder,
        WPFlatbuffers.UShort.createUShort(builder, u.assetId)
      );
    }
    if (u.speed !== undefined) {
      WPFlatbuffers.Update.addSpeed(
        builder,
        WPFlatbuffers.Float.createFloat(builder, u.speed)
      );
    }
    if (u.deleted) {
      WPFlatbuffers.Update.addDeleted(builder, true);
    }
    if (u.position !== undefined) {
      const { x, y, z } = u.position;
      WPFlatbuffers.Update.addPosition(
        builder,
        WPFlatbuffers.Vector3.createVector3(builder, x, y, z)
      );
    }
    if (u.rotation !== undefined) {
      const { x, y, z } = u.rotation;
      WPFlatbuffers.Update.addRotation(
        builder,
        WPFlatbuffers.Vector3.createVector3(builder, x, y, z)
      );
    }
    if (u.scale !== undefined) {
      const { x, y, z } = u.scale;
      WPFlatbuffers.Update.addScale(
        builder,
        WPFlatbuffers.Vector3.createVector3(builder, x, y, z)
      );
    }
    if (u.up !== undefined) {
      const { x, y, z } = u.up;
      WPFlatbuffers.Update.addUp(
        builder,
        WPFlatbuffers.Vector3.createVector3(builder, x, y, z)
      );
    }
    const uFB = WPFlatbuffers.Update.endUpdate(builder);
    return uFB;
  });

  const updatesFB = WPFlatbuffers.Diff.createUpdatesVector(builder, uFBs);

  WPFlatbuffers.Diff.startDiff(builder);
  WPFlatbuffers.Diff.addVersion(
    builder,
    WPFlatbuffers.UShort.createUShort(builder, diff.v)
  );
  WPFlatbuffers.Diff.addUpdates(builder, updatesFB);
  const diffFB = WPFlatbuffers.Diff.endDiff(builder);
  WPFlatbuffers.Diff.finishDiffBuffer(builder, diffFB);

  return builder.asUint8Array();
}

export function deserializeDiff(data: WirePlaceSceneSerialized): Diff {
  const buf = new flatbuffers.ByteBuffer(data);
  const diffFB = WPFlatbuffers.Diff.getRootAsDiff(buf);
  const diff: Diff = { v: diffFB.version()?.value() || 0, d: {} };

  for (let i = 0; i < diffFB.updatesLength(); i += 1) {
    const uFB = diffFB.updates(i);
    if (!uFB) {
      continue;
    }

    const actorId = uFB.actorId();
    if (!actorId) {
      continue;
    }

    const u: Update = { actorId };
    if (uFB.deleted()) {
      u.deleted = true;
    }

    if (uFB.color()) {
      u.color = uFB.color()?.value();
    }

    if (uFB.assetId()) {
      u.assetId = uFB.assetId()?.value();
    }

    if (uFB.speed()) {
      u.speed = uFB.speed()?.value();
    }

    let v = uFB.position();
    if (v) {
      u.position = { x: v.x(), y: v.y(), z: v.z() };
    }

    v = uFB.rotation();
    if (v) {
      u.rotation = { x: v.x(), y: v.y(), z: v.z() };
    }

    v = uFB.scale();
    if (v) {
      u.scale = { x: v.x(), y: v.y(), z: v.z() };
    }

    v = uFB.up();
    if (v) {
      u.up = { x: v.x(), y: v.y(), z: v.z() };
    }

    diff.d[actorId] = u;
  }

  return diff;
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

  updateActor(
    actorId: string,
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
      return { v: this._version, d: updates };
    } else {
      const updates = this._updates;
      this._updates = {};
      return { v: this._version, d: updates };
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

  applyDiff(diff: Diff, skipId: string | null = null) {
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

  applySerializedDiff(
    data: WirePlaceSceneSerialized,
    skipId: string | null = null
  ) {
    const diff = deserializeDiff(data);
    return this.applyDiff(diff, skipId);
  }
}

export default WirePlaceScene;
