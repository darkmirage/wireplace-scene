import { flatbuffers } from 'flatbuffers';

import { WPFlatbuffers } from './flatbuffers/WirePlaceFlatBuffers_generated';
import {
  Actor,
  ActorID,
  Diff,
  Update,
  WirePlaceSceneSerialized,
} from './types';

export function createNewActor(actorId: ActorID): Actor {
  return {
    revision: 0,
    actorId,
    collidable: true,
    movable: false,
    deleted: false,
    action: {
      type: 0,
      state: -1,
    },
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

export function serializeID(actorId: ActorID): number {
  return parseInt(actorId.substr(1), 10);
}

export function deserializeID(id: number): ActorID {
  return `a${id}`;
}

export function serializeDiff(diff: Diff): WirePlaceSceneSerialized {
  const builder = new flatbuffers.Builder();

  const uFBs = Object.keys(diff.d).map((actorId) => {
    const u = diff.d[actorId];
    const id = serializeID(actorId);

    WPFlatbuffers.Update.startUpdate(builder);
    WPFlatbuffers.Update.addActorId(
      builder,
      WPFlatbuffers.UShort.createUShort(builder, id)
    );

    if (u.revision !== undefined) {
      WPFlatbuffers.Update.addRevision(
        builder,
        WPFlatbuffers.UShort.createUShort(builder, u.revision)
      );
    }
    if (u.color !== undefined) {
      WPFlatbuffers.Update.addColor(
        builder,
        WPFlatbuffers.UInt.createUInt(builder, u.color)
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
    if (u.movable !== undefined) {
      WPFlatbuffers.Update.addMovable(
        builder,
        WPFlatbuffers.Bool.createBool(builder, u.movable)
      );
    }
    if (u.collidable !== undefined) {
      WPFlatbuffers.Update.addCollidable(
        builder,
        WPFlatbuffers.Bool.createBool(builder, u.collidable)
      );
    }
    if (u.deleted) {
      WPFlatbuffers.Update.addDeleted(builder, true);
    }
    if (u.action) {
      WPFlatbuffers.Update.addAction(
        builder,
        WPFlatbuffers.NetworkedAnimationAction.createNetworkedAnimationAction(
          builder,
          u.action.type,
          u.action.state
        )
      );
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

    const id = uFB.actorId()?.value();
    if (id === undefined) {
      continue;
    }
    const actorId = deserializeID(id);

    const u: Update = { actorId };

    if (uFB.revision()) {
      u.revision = uFB.revision()?.value();
    }

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

    if (uFB.movable()) {
      u.movable = uFB.movable()?.value();
    }

    if (uFB.collidable()) {
      u.collidable = uFB.collidable()?.value();
    }

    const action = uFB.action();
    if (action) {
      u.action = {
        type: action.type(),
        state: action.state(),
      };
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
