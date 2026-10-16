import * as THREE from "../../vendor/three.module.js";
import { loadHandModels, createRiggedHand, FLASHLIGHT_GRIP } from "./hand-rig.js";
export const HAND_SKIN = "assets/images/hand-skin-v12.png";
let skinTexture;
export async function loadHandSurface(bytes = {}) {
  await Promise.all([
    loadHandModels(bytes),
    new THREE.TextureLoader().loadAsync(HAND_SKIN).then((t) => {
      skinTexture = t;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    }),
  ]);
}
function frame(x, y) {
  x.normalize();
  y.addScaledVector(x, -y.dot(x)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y).normalize()),
  );
}
function sleeve(hand) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x283337,
    roughness: 0.96,
  });
  const profile = [];
  for (let i = 0; i <= 18; i++) {
    const y = -0.012 - i * 0.016,
      r = 0.029 + i * 0.001;
    profile.push(new THREE.Vector2(r, y));
  }
  const geometry = new THREE.LatheGeometry(profile.reverse(), 48),
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      a = Math.atan2(p.getZ(i), p.getX(i)),
      fold = 1 + 0.025 * Math.sin(y * 140 + a * 3);
    p.setXYZ(i, p.getX(i) * fold, p.getY(i), p.getZ(i) * fold * 0.82);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  hand.root.add(mesh);
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.029, 0.005, 12, 48),
    material,
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.018;
  cuff.scale.y = 0.83;
  hand.root.add(cuff);
  return mesh;
}
/** Two separate skinned human hands: right cylindrical grip and relaxed left balancing pose. */
export function createFlashlightViewModel(camera, scene) {
  if (!camera.parent) scene.add(camera);
  const root = new THREE.Group();
  root.name = "Eli first-person hands";
  camera.add(root);
  const skin = new THREE.MeshPhysicalMaterial({
    color: skinTexture ? 0xffffff : 0xc6a88b,
    map: skinTexture ?? null,
    roughness: 0.67,
    clearcoat: 0.065,
    clearcoatRoughness: 0.5,
  });
  if (skinTexture) {
    skin.bumpMap = skinTexture.clone();
    skin.bumpMap.colorSpace = THREE.NoColorSpace;
    skin.bumpMap.needsUpdate = true;
    skin.bumpScale = 0.00035;
  }
  const right = createRiggedHand("right", skin),
    left = createRiggedHand("left", skin);
  root.add(right.root, left.root);
  right.root.position.set(0.23, -0.245, -0.47);
  right.root.quaternion.copy(
    frame(
      new THREE.Vector3(0.11, 0.18, 0.977),
      new THREE.Vector3(-0.1, 0.978, -0.17),
    ),
  );
  left.root.position.set(-0.275, -0.275, -0.52);
  left.root.quaternion.copy(
    frame(
      new THREE.Vector3(0.95, 0.2, 0.1),
      new THREE.Vector3(0.02, 0.9, -0.43),
    ),
  );
  right.forearm = sleeve(right);
  left.forearm = sleeve(left);
  left.root.visible = true;
  const torch = new THREE.Group();
  torch.name = "Held flashlight";
  right.root.add(torch);
  torch.position.fromArray(FLASHLIGHT_GRIP.center);
  torch.rotation.z = FLASHLIGHT_GRIP.angle;
  torch.userData.gripRadius = FLASHLIGHT_GRIP.radius;
  const steel = new THREE.MeshStandardMaterial({
      color: 0x343c37,
      metalness: 0.72,
      roughness: 0.4,
    }),
    rubber = new THREE.MeshStandardMaterial({
      color: 0x141b18,
      roughness: 0.94,
    });
  const cylinder = (mat, r1, r2, length, x) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r2, length, 48),
      mat,
    );
    m.rotation.z = Math.PI / 2;
    m.position.x = x;
    torch.add(m);
    return m;
  };
  // Keep the rubber above the metal core; coincident surfaces flickered
  // through the fingers and made the old grip look broken.
  cylinder(steel, 0.0148, 0.0148, 0.21, -0.035);
  cylinder(rubber, FLASHLIGHT_GRIP.radius, FLASHLIGHT_GRIP.radius, 0.135, -0.004);
  for (let i = 0; i < 7; i++)
    cylinder(rubber, 0.0172, 0.0172, 0.0035, -0.059 + i * 0.019);
  cylinder(steel, 0.018, 0.018, 0.009, 0.072);
  cylinder(rubber, 0.012, 0.012, 0.004, 0.079);
  cylinder(steel, 0.036, 0.018, 0.045, -0.152);
  cylinder(steel, 0.038, 0.038, 0.012, -0.18);
  const lens = cylinder(
    new THREE.MeshStandardMaterial({
      color: 0xe3e2cf,
      emissive: 0xd0d3bb,
      emissiveIntensity: 0.7,
      roughness: 0.17,
    }),
    0.032,
    0.032,
    0.004,
    -0.188,
  );
  const fill = new THREE.PointLight(0xe0d4bd, 0.1, 0.65, 1);
  fill.position.set(0, -0.07, -0.18);
  camera.add(fill);
  // Roll the fist about the barrel, preserving its aim and centre. The forearm
  // now enters from the lower right instead of holding the wrist vertically.
  const gripCenter = torch.position.clone().applyQuaternion(right.root.quaternion).add(right.root.position);
  const gripAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(torch.quaternion);
  right.root.rotateOnAxis(gripAxis, 0.87);
  right.root.position.copy(gripCenter).sub(torch.position.clone().applyQuaternion(right.root.quaternion));
  const home = [right, left].map((h) => [
    h,
    h.root.position.clone(),
    h.root.quaternion.clone(),
  ]);
  return {
    root,
    lens,
    fill,
    torch,
    hands: [right, left],
    leftHand: left.root,
    fingers: right.fingers,
    thumb: right.thumb,
    palm: right.palm,
    wrist: right.wrist,
    forearm: right.forearm,
    update(player, time) {
      const bob = player.moving
        ? Math.sin(player.bob)
        : Math.sin(time * 1.6) * 0.15;
      for (const [h, p, q] of home) {
        h.root.position.copy(p);
        h.root.quaternion.copy(q);
        h.root.position.y +=
          bob * 0.005 -
          (player.physics?.velocity || 0) * 0.004 +
          (player.physics?.landing || 0) * 0.12;
      }
      left.root.rotateX(player.sprinting ? 0.08 : 0);
      right.root.rotateX(player.sprinting ? 0.05 : 0);
      root.visible = !player.hidden;
      fill.intensity = player.flashlight && player.battery > 0 && !player.hidden
        ? 0.1 * player.lightFactor : 0.004;
      lens.material.emissiveIntensity =
        player.flashlight && player.battery > 0
          ? 0.8 * player.lightFactor
          : 0.02;
    },
    muzzle() {
      root.updateWorldMatrix(true, true);
      return torch.localToWorld(new THREE.Vector3(-0.19, 0, 0));
    },
  };
}
