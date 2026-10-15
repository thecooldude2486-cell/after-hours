import { animateScareFace } from "./horror-detail.js";
import * as THREE from "../../vendor/three.module.js";
/** Shared animation layer applied after the authored skeleton's base clips, never baked into idle poses. */
export function applyScarePose(actor, time) {
  const r = actor.userData,
    amount = r.scareAmount || 0;
  animateScareFace(
    r.face,
    (r.teacher ? 0.32 + amount * 0.68 : amount) +
      (r.speaking ? 0.12 * (1 + Math.sin(time * 14)) : 0),
    time,
  );
  if (!amount || !r.model) return;
  const bone = (n) => r.model.getObjectByName(n);
  bone("Chest")?.rotateX(-0.22 * amount);
  // Aim both rigs in world space: imported bones and procedural bones use different local axes.
  actor.updateMatrixWorld(true);
  for (const side of ["L", "R"]) {
    for (const [name, childName, spread] of [
      ["UpperArm", "LowerArm", 0.18],
      ["LowerArm", "Wrist", 0.03],
    ]) {
      const joint = bone(name + side),
        child = bone(childName + side);
      if (!joint || !child) continue;
      const worldQ = joint.getWorldQuaternion(new THREE.Quaternion());
      const current = child.position
        .clone()
        .normalize()
        .applyQuaternion(worldQ);
      const desired = new THREE.Vector3(
        (side === "L" ? -1 : 1) * spread,
        -0.12,
        -1,
      )
        .normalize()
        .applyQuaternion(actor.getWorldQuaternion(new THREE.Quaternion()));
      const target = new THREE.Quaternion()
        .setFromUnitVectors(current, desired)
        .multiply(worldQ);
      const parentQ = joint.parent
        .getWorldQuaternion(new THREE.Quaternion())
        .invert();
      target.premultiply(parentQ);
      joint.quaternion.slerp(target, Math.min(1, amount * 0.9));
      actor.updateMatrixWorld(true);
    }
  }
  r.head?.rotateZ(Math.sin(time * 27) * 0.035 * amount);
  r.head?.rotateX(-0.18 * amount);
  for (const side of ["L", "R"])
    for (const finger of ["Index1", "Middle1", "Ring1", "Pinky1"])
      bone(finger + side)?.rotateX(0.22 * amount);
  if (r.maw) r.maw.scale.y = 0.065 * (1 + 0.45 * amount);
  if (r.mouth) r.mouth.scale.y = 0.029 * (1 + 0.9 * amount);
}
export function faceTarget(actor, fallback) {
  if (actor?.userData.face) {
    actor.updateMatrixWorld(true);
    return actor.userData.face.localToWorld(
      actor.userData.face.userData.gazePoint?.clone() ||
        new THREE.Vector3(0, 0.015, -0.11),
    );
  }
  if (actor?.userData.head) {
    actor.updateMatrixWorld(true);
    return actor.userData.head
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, 0.13, 0));
  }
  return actor.position.clone().setY(fallback);
}
