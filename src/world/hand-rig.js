import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/GLTFLoader.js";
import { clone } from "../../vendor/SkeletonUtils.js";

export const HAND_MODELS = {
  left: "assets/models/hand-left-v14.glb",
  right: "assets/models/hand-right-v14.glb",
};
const templates = new Map();
const digitNames = [
  "index-finger",
  "middle-finger",
  "ring-finger",
  "pinky-finger",
];
export async function loadHandModels(bytes = {}) {
  await Promise.all(
    Object.entries(HAND_MODELS).map(async ([side, path]) => {
      const loader = new GLTFLoader();
      const asset = bytes[side]
        ? await new Promise((resolve, reject) =>
            loader.parse(bytes[side], "", resolve, reject),
          )
        : await loader.loadAsync(path);
      templates.set(side, asset.scene);
    }),
  );
}

/** Continuous authored skin, with real phalangeal chains rather than independent finger tubes. */
export function createRiggedHand(side, material) {
  if (!templates.has(side))
    throw Error("Hand meshes must be preloaded before creating the player");
  const root = new THREE.Group(),
    model = clone(templates.get(side));
  root.add(model);
  root.name = side + " anatomical hand";
  model.updateMatrixWorld(true);
  const bone = (name) => model.getObjectByName(name),
    wrist = bone("wrist");
  for (const digit of ["thumb", ...digitNames]) {
    const chain =
      digit === "thumb"
        ? ["metacarpal", "phalanx-proximal", "phalanx-distal", "tip"]
        : [
            "metacarpal",
            "phalanx-proximal",
            "phalanx-intermediate",
            "phalanx-distal",
            "tip",
          ];
    let parent = wrist;
    for (const name of chain) {
      const joint = bone(digit + "-" + name);
      model.updateMatrixWorld(true);
      parent.attach(joint);
      parent = joint;
    }
  }
  // WebXR meshes use a different anatomical basis on each side; these are rotations, not mirrored scales.
  const s = side === "right" ? 1 : -1;
  const basis = new THREE.Matrix4().set(
    0,
    0,
    s,
    0,
    0,
    -1,
    0,
    0,
    s,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
  );
  const q = new THREE.Quaternion().setFromRotationMatrix(basis);
  const origin = wrist.getWorldPosition(new THREE.Vector3()).applyQuaternion(q);
  model.quaternion.copy(q);
  model.position.copy(origin.negate());
  root.updateMatrixWorld(true);
  const mesh = model.getObjectByProperty("isSkinnedMesh", true);
  mesh.material = material.clone();
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const nailFrames = ["thumb", ...digitNames].map((name) => {
    const joint = bone(name + "-phalanx-distal");
    return {
      joint,
      tip: bone(name + "-tip"),
      normal: new THREE.Vector3(0, 0, 1).applyQuaternion(
        joint.getWorldQuaternion(new THREE.Quaternion()).invert(),
      ),
      thumb: name === "thumb",
    };
  });
  const joints = [
    wrist,
    ...digitNames.flatMap((n) =>
      [
        "metacarpal",
        "phalanx-proximal",
        "phalanx-intermediate",
        "phalanx-distal",
        "tip",
      ].map((p) => bone(n + "-" + p)),
    ),
    ...["metacarpal", "phalanx-proximal", "phalanx-distal", "tip"].map((p) =>
      bone("thumb-" + p),
    ),
  ];
  const turn = (joint, axis, angle) => {
    root.updateMatrixWorld(true);
    const worldQ = joint.getWorldQuaternion(new THREE.Quaternion());
    const rotated = new THREE.Quaternion()
      .setFromAxisAngle(axis, angle)
      .multiply(worldQ);
    joint.quaternion.copy(
      joint.parent
        .getWorldQuaternion(new THREE.Quaternion())
        .invert()
        .multiply(rotated),
    );
  };
  // Flexion progresses from MCP to PIP to DIP. Preserve lengths and the sculpted web spaces.
  for (let i = 0; i < 4; i++) {
    const angles =
      side === "right"
        ? [[96, 100, 65], [94, 100, 65], [90, 100, 65], [84, 100, 65]][i]
        : [12 + i * 2, 18 + i * 3, 8 + i * 2];
    for (const [j, name] of [
      "phalanx-proximal",
      "phalanx-intermediate",
      "phalanx-distal",
    ].entries())
      turn(
        bone(digitNames[i] + "-" + name),
        new THREE.Vector3(1, 0, 0),
        -THREE.MathUtils.degToRad(angles[j]),
      );
  }
  if (side === "right") {
    // Set the thumb saddle first; solving all three joints freely pulled the
    // proximal phalanx through the barrel. Keep it on the near side of the grip.
    const saddle = bone("thumb-metacarpal"), proximal = bone("thumb-phalanx-proximal");
    root.updateMatrixWorld(true);
    const origin = saddle.getWorldPosition(new THREE.Vector3());
    const direction = proximal.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
    const desired = new THREE.Vector3(-0.046, 0.062, 0.002).sub(origin).normalize();
    const saddleQ = new THREE.Quaternion().setFromUnitVectors(direction, desired)
      .multiply(saddle.getWorldQuaternion(new THREE.Quaternion()));
    saddle.quaternion.copy(saddle.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(saddleQ));
    const target = new THREE.Vector3(-0.025, 0.092, -0.008),
      tip = bone("thumb-tip");
    const chain = [
      bone("thumb-phalanx-distal"),
      bone("thumb-phalanx-proximal"),
    ];
    for (let pass = 0; pass < 14; pass++)
      for (const joint of chain) {
        root.updateMatrixWorld(true);
        const at = joint.getWorldPosition(new THREE.Vector3()),
          from = tip.getWorldPosition(new THREE.Vector3()).sub(at).normalize(),
          to = target.clone().sub(at).normalize();
        const delta = new THREE.Quaternion().setFromUnitVectors(from, to),
          angle = new THREE.Quaternion().angleTo(delta);
        delta.slerp(
          new THREE.Quaternion(),
          Math.max(0, 1 - 0.18 / Math.max(angle, 0.001)),
        );
        const q = delta.multiply(
          joint.getWorldQuaternion(new THREE.Quaternion()),
        );
        joint.quaternion.copy(
          joint.parent
            .getWorldQuaternion(new THREE.Quaternion())
            .invert()
            .multiply(q),
        );
      }
  } else turn(bone("thumb-metacarpal"), new THREE.Vector3(0, 0, 1), -0.12);
  root.updateMatrixWorld(true);
  const nailMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xcab19d,
    roughness: 0.42,
    clearcoat: 0.22,
  });
  const nails = [];
  for (const f of nailFrames) {
    const a = f.joint.getWorldPosition(new THREE.Vector3()),
      b = f.tip.getWorldPosition(new THREE.Vector3()),
      y = b.clone().sub(a).normalize();
    const normal = f.normal
      .clone()
      .applyQuaternion(f.joint.getWorldQuaternion(new THREE.Quaternion()));
    normal.addScaledVector(y, -normal.dot(y)).normalize();
    const x = y.clone().cross(normal).normalize();
    const nail = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 14),
      nailMaterial,
    );
    nail.position
      .copy(a)
      .lerp(b, 0.55)
      .addScaledVector(normal, f.thumb ? 0.007 : 0.0055);
    nail.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(x, y, normal),
    );
    nail.scale.set(f.thumb ? 0.0062 : 0.0047, a.distanceTo(b) * 0.33, 0.0008);
    root.add(nail);
    root.updateMatrixWorld(true);
    f.joint.attach(nail);
    nails.push(nail);
  }
  const palm = new THREE.Group();
  palm.position.set(0, 0.055, 0);
  root.add(palm);
  const pose = joints.map((j) => [j, j.position.clone(), j.quaternion.clone()]);
  return {
    side,
    root,
    model,
    mesh,
    wrist,
    palm,
    joints,
    pose,
    nails,
    thumb: bone("thumb-phalanx-proximal"),
    fingers: digitNames.map((n) => bone(n + "-phalanx-proximal")),
    resetPose() {
      for (const [j, p, q] of pose) {
        j.position.copy(p);
        j.quaternion.copy(q);
      }
    },
  };
}
