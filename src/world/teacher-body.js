import * as THREE from "../../vendor/three.module.js";
import { horrorMaterial } from "./horror-detail.js";

/** Adult clothing and limbs follow the independent animation skeleton, without the cartoon body mesh. */
export function dressTeacher(root) {
  const rig = root.userData,
    model = rig.model;
  const bone = (name) => model.getObjectByName(name);
  const skin = horrorMaterial("skin", 0xaba397);
  const cloth = horrorMaterial("cloth", 0x3a3c36);
  const shoe = new THREE.MeshStandardMaterial({
    color: 0x171914,
    roughness: 0.57,
  });
  const attach = (joint, geometry, material, position, scale = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.fromArray(scale);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    root.updateMatrixWorld(true);
    joint?.attach(mesh);
    return mesh;
  };
  const point = (name) =>
    root.worldToLocal(bone(name).getWorldPosition(new THREE.Vector3()));
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const torso = new THREE.LatheGeometry(
    [
      [0.143, 0],
      [0.158, 0.06],
      [0.154, 0.14],
      [0.165, 0.23],
      [0.178, 0.31],
      [0.186, 0.38],
      [0.162, 0.45],
      [0.063, 0.49],
    ].map((p) => new THREE.Vector2(...p)),
    64,
  );
  const vertices = torso.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i),
      a = Math.atan2(vertices.getZ(i), vertices.getX(i));
    const fold = 1 + Math.sin(a * 14 + y * 17) * 0.017;
    vertices.setX(i, vertices.getX(i) * fold);
    vertices.setZ(i, vertices.getZ(i) * 0.57 * fold);
  }
  torso.computeVertexNormals();
  rig.coat = attach(
    bone("Chest"),
    torso,
    cloth,
    new THREE.Vector3(0, 0.835, -0.025),
  );
  attach(
    bone("Neck"),
    new THREE.CapsuleGeometry(0.041, 0.13, 12, 32),
    skin,
    new THREE.Vector3(0, 1.38, -0.016),
  );
  for (const side of ["L", "R"]) {
    for (const [start, end, radius, mat] of [
      ["UpperArm", "LowerArm", 0.052, cloth],
      ["LowerArm", "Wrist", 0.044, cloth],
      ["LowerLeg", "Foot", 0.034, cloth],
    ]) {
      if (!bone(start + side) || !bone(end + side)) continue;
      const a = point(start + side),
        b = point(end + side),
        length = a.distanceTo(b);
      const geo = new THREE.CapsuleGeometry(
        radius,
        Math.max(0.01, length - radius * 1.4),
        12,
        32,
      );
      const sleeve = attach(
        bone(start + side),
        geo,
        mat,
        a.clone().add(b).multiplyScalar(0.5),
      );
      // The bone's axis differs between the authored left and right arm.
      const worldQ = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      );
      sleeve.quaternion.copy(
        bone(start + side)
          .getWorldQuaternion(new THREE.Quaternion())
          .invert()
          .multiply(worldQ),
      );
    }
    const wrist = point("Wrist" + side),
      palm = wrist.clone().add(new THREE.Vector3(0, -0.026, -0.013));
    attach(bone("Wrist" + side), sphere, skin, palm, [0.032, 0.047, 0.017]);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.017;
      const curve = new THREE.CatmullRomCurve3([
        palm.clone().add(new THREE.Vector3(x, -0.027, 0)),
        palm.clone().add(new THREE.Vector3(x, -0.054, -0.008)),
        palm.clone().add(new THREE.Vector3(x, -0.079, -0.022)),
        palm.clone().add(new THREE.Vector3(x, -0.087, -0.038)),
      ]);
      attach(
        bone("Wrist" + side),
        new THREE.TubeGeometry(curve, 18, 0.0068, 10, false),
        skin,
        new THREE.Vector3(),
      );
    }
    const sign = side === "L" ? -1 : 1;
    attach(
      bone("Wrist" + side),
      new THREE.CapsuleGeometry(0.009, 0.027, 8, 20),
      skin,
      palm.clone().add(new THREE.Vector3(sign * 0.034, -0.013, -0.018)),
    );
    const foot = point("Foot" + side);
    attach(
      bone("Foot" + side),
      sphere,
      shoe,
      foot.clone().add(new THREE.Vector3(0, 0.015, -0.045)),
      [0.054, 0.042, 0.105],
    );
  }
  rig.realisticBody = true;
}
