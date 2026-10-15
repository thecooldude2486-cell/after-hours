import * as THREE from "../../vendor/three.module.js";
import { applyScarePose } from "./scare-motion.js";
import {
  createScareFace,
  horrorMaterial,
  mesh,
  ellipsoid,
  cord,
} from "./horror-detail.js";
/** Continuous tapered limb with modest sleeve folds, rather than intersecting oval segments. */
function limb(
  parent,
  material,
  length,
  top,
  bottom,
  cloth = false,
  direction = [0, -length, 0],
) {
  const axis = new THREE.Vector3(...direction);
  length = axis.length();
  const profile = [
    [0, 0],
    [top * 0.6, -0.012],
    [top, -0.04],
    [top * 0.88, -length * 0.4],
    [bottom * 1.12, -length * 0.72],
    [bottom, -length + 0.02],
    [0, -length],
  ];
  // Lathe accepts the profile in ascending height order.
  const geometry = new THREE.LatheGeometry(
    profile.reverse().map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  );
  const p = geometry.attributes.position;
  if (cloth)
    for (let i = 0; i < p.count; i++) {
      const angle = Math.atan2(p.getZ(i), p.getX(i)),
        fold = 1 + Math.sin(angle * 11 + p.getY(i) * 38) * 0.025;
      p.setX(i, p.getX(i) * fold);
      p.setZ(i, p.getZ(i) * fold);
    }
  geometry.computeVertexNormals();
  const surface = mesh(parent, geometry, material);
  surface.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    axis.normalize(),
  );
  return surface;
}
/** Bespoke articulated silhouette; no named identity or added supernatural explanation. */
export function createRoomMonster(variant = "office") {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  root.name = "Room shadow";
  root.visible = false;
  const cloth = horrorMaterial("cloth", 0x303831),
    skin = horrorMaterial("skin", 0x777d6c),
    seam = horrorMaterial("cloth", 0x151b16);
  const bones = {};
  const joint = (name, parent, p) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.fromArray(p);
    parent.add(o);
    bones[name] = o;
    return o;
  };
  const chest = joint("Chest", body, [0, 1.16, 0.015]);
  const torso = new THREE.LatheGeometry(
    [
      [0.13, -0.41],
      [0.2, -0.31],
      [0.16, -0.08],
      [0.205, 0.15],
      [0.13, 0.2],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    48,
  );
  const fabric = torso.attributes.position;
  for (let i = 0; i < fabric.count; i++) {
    const x = fabric.getX(i),
      y = fabric.getY(i),
      z = fabric.getZ(i);
    const fold =
      1 +
      Math.sin(Math.atan2(x, z) * 13 + y * 8) * 0.035 +
      Math.sin(y * 33 + x * 17) * 0.012;
    fabric.setXYZ(i, x * fold, y, z * fold);
  }
  torso.computeVertexNormals();
  mesh(chest, torso, cloth, [0, 0, 0], [1, 1, 0.65]);
  // Physical fabric folds and uneven hems break up the silhouette without painted-on body parts.
  for (let i = 0; i < 13; i++)
    cord(
      chest,
      seam,
      [
        [Math.sin(i * 2.4) * 0.12, -0.34, -0.1],
        [Math.sin(i * 2.4) * 0.17, -0.15, -0.117],
        [Math.sin(i * 2.4) * 0.19, 0.07, -0.11],
      ],
      0.003,
    );
  const neck = joint("Neck", chest, [0.014, 0.16, 0.013]);
  ellipsoid(neck, skin, [0, 0.16, 0], [0.057, 0.19, 0.05]);
  for (const side of [-1, 1])
    cord(
      neck,
      skin,
      [
        [side * 0.037, 0.03, -0.025],
        [side * 0.031, 0.17, -0.047],
        [side * 0.028, 0.29, -0.02],
      ],
      0.008,
    );
  const head = joint("Head", neck, [0, 0.32, -0.023]),
    face = createScareFace();
  head.add(face);
  face.scale.set(1.02, 1.08, 1.02);
  const hands = [],
    fingers = [];
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? "L" : "R";
    const shoulder = joint("UpperArm" + suffix, chest, [side * 0.19, 0.11, 0]);
    limb(shoulder, cloth, 0.32, 0.061, 0.047, true, [
      side * 0.049,
      -0.31,
      -0.008,
    ]);
    const elbow = joint("LowerArm" + suffix, shoulder, [
      side * 0.049,
      -0.31,
      -0.008,
    ]);
    limb(elbow, skin, 0.335, 0.038, 0.023, false, [side * 0.022, -0.33, 0]);
    ellipsoid(elbow, skin, [0, 0, 0], [0.035, 0.035, 0.033]);
    const wrist = joint("Wrist" + suffix, elbow, [side * 0.022, -0.33, 0]);
    hands.push(wrist);
    ellipsoid(wrist, skin, [0, -0.047, 0], [0.048, 0.075, 0.025]);
    for (let finger = 0; finger < 4; finger++) {
      const name = ["Index1", "Middle1", "Ring1", "Pinky1"][finger] + suffix;
      const f = joint(name, wrist, [(finger - 1.5) * 0.024, -0.092, 0]);
      fingers.push(f);
      const length = 0.08 + (finger === 1 ? 0.025 : 0);
      ellipsoid(f, skin, [0, -length * 0.45, 0], [0.009, length * 0.5, 0.01]);
      ellipsoid(f, skin, [0, -length, 0.002], [0.011, 0.011, 0.011]);
      const tip = joint("Tip" + finger + suffix, f, [0, -length, 0]);
      ellipsoid(tip, skin, [0, -0.035, -0.014], [0.007, 0.038, 0.008]);
      const nail = mesh(
        tip,
        new THREE.CapsuleGeometry(0.004, 0.011, 4, 10),
        seam,
        [0, -0.07, -0.016],
      );
      nail.rotation.z = Math.PI;
    }
    ellipsoid(
      wrist,
      skin,
      [side * 0.053, -0.012, -0.007],
      [0.012, 0.044, 0.012],
    );
    const hip = joint("Hip" + suffix, body, [side * 0.096, 0.77, 0]);
    limb(hip, cloth, 0.405, 0.074, 0.048, true, [0, -0.4, 0.017]);
    const shin = joint("Shin" + suffix, hip, [0, -0.4, 0.017]);
    limb(shin, cloth, 0.345, 0.049, 0.033, true);
    ellipsoid(shin, seam, [0, -0.34, -0.032], [0.069, 0.055, 0.135]);
  }
  root.userData = {
    procedural: true,
    model: body,
    head,
    face,
    bones,
    hands,
    fingers,
    scareAmount: 0,
  };
  root.userData.variant = variant;
  if (variant === "phone") {
    face.scale.set(0.97, 1.06, 0.99);
    head.position.x = 0.037;
    cloth.color.setHex(0x384049);
  } else if (variant === "archive") {
    face.scale.set(1.04, 0.98, 1.02);
    neck.scale.y = 0.87;
    chest.scale.set(1.12, 1.04, 1.06);
    skin.color.setHex(0x857361);
  }
  return root;
}
export function animateRoomMonster(root, dt, time) {
  const r = root.userData,
    b = r.bones,
    amount = r.scareAmount || 0;
  b.Chest.rotation.set(0.1, 0, 0.009 * Math.sin(time * 1.3));
  b.Neck.rotation.set(-0.16, 0, -0.1);
  b.Head.rotation.set(
    -0.07,
    Math.sin(time * 1.3) * 0.06,
    0.16 + Math.sin(time * 1.1) * 0.009,
  );
  for (const side of ["L", "R"]) {
    b["UpperArm" + side].rotation.set(
      0.58,
      side === "L" ? -0.13 : 0.15,
      side === "L" ? 0.17 : -0.2,
    );
    b["LowerArm" + side].rotation.set(0.36, 0, 0);
    b["Wrist" + side].rotation.set(0.13, 0, side === "L" ? -0.12 : 0.12);
  }
  r.fingers.forEach((f, i) =>
    f.rotation.set(0.25 + Math.sin(time * 3 + i) * 0.07, 0, 0),
  );
  applyScarePose(root, time);
  // Authored room-specific movement remains visible throughout the struggle.
  const beat = Math.sin(time * (r.variant === "phone" ? 19 : 7));
  if (r.variant === "phone") {
    // Receiver gesture, a broken-neck snap and alternating convulsions.
    b.Head.rotation.z += (Math.sin(time * 8) > 0.65 ? -0.42 : 0.22) * amount;
    b.Neck.rotation.y += Math.sin(time * 5) * 0.24 * amount;
    b.UpperArmL.rotateX(-0.65 * amount);
    b.LowerArmL.rotateX(-1.05 * amount);
    b.WristL.rotateZ(0.5 * amount);
    b.Chest.rotateY(beat * 0.13 * amount);
    b.UpperArmR.rotateZ(beat * 0.18 * amount);
  } else if (r.variant === "archive") {
    // A low, heavy heave followed by a two-handed raking motion.
    b.Chest.rotateX((0.24 + beat * 0.16) * amount);
    b.Head.rotateX(-0.24 * amount);
    b.UpperArmL.rotateZ((0.28 + beat * 0.2) * amount);
    b.UpperArmR.rotateZ((-0.28 - beat * 0.2) * amount);
    b.LowerArmL.rotateX(Math.max(0, beat) * 0.55 * amount);
    b.LowerArmR.rotateX(Math.max(0, beat) * 0.55 * amount);
  } else {
    // Office shape rocks side-to-side and snatches with alternate hands.
    b.Chest.rotateZ(beat * 0.16 * amount);
    b.Head.rotateZ(-beat * 0.24 * amount);
    b.UpperArmL.rotateX(Math.sin(time * 9) * 0.34 * amount);
    b.UpperArmR.rotateX(-Math.sin(time * 9) * 0.34 * amount);
    b.WristL.rotateY(beat * 0.35 * amount);
    b.WristR.rotateY(-beat * 0.35 * amount);
  }
}

/** A restrained doorway lean: tilted face, one raised hand, body held almost motionless. */
export function animateDoorwayPeek(root, dt, time, lean = 1) {
  root.userData.scareAmount = 0;
  animateRoomMonster(root, dt, time);
  const b = root.userData.bones;
  b.Chest.rotation.set(0.06, 0, -0.22 * lean);
  b.Neck.rotation.set(-0.05, 0, 0.12 * lean);
  b.Head.rotation.set(-0.08, 0, 0.42 * lean);
  b.UpperArmR.rotation.set(-0.45, 0.15, -0.72);
  b.LowerArmR.rotation.set(-1.55, 0, 0.15);
  b.WristR.rotation.set(-0.15, 0, -0.2);
  // Keep the eyes and mouth still until the retreat; frantic idle animation spoils the glimpse.
  root.userData.face.userData.jaw?.rotation.set(0, 0, 0);
}
