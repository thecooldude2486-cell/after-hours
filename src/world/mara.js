import * as THREE from "../../vendor/three.module.js";
import { GLTFLoader } from "../../vendor/GLTFLoader.js";
import { clone } from "../../vendor/SkeletonUtils.js";
let template;
/** Preload one authored, fully clothed rig; clones retain independent skeletons and animation mixers. */
export async function loadMaraModel(bytes) {
  const loader = new GLTFLoader();
  template = bytes
    ? await new Promise((resolve, reject) =>
        loader.parse(bytes, "", resolve, reject),
      )
    : await loader.loadAsync("assets/models/mara-base.glb");
  return template;
}
export function createMara() {
  if (!template)
    throw new Error("Mara model must be loaded before constructing the school");
  const root = new THREE.Group();
  root.name = "Mara Ward";
  const model = clone(template.scene);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(new THREE.Vector3());
  const height = 1.64 / size.y;
  const visual = new THREE.Group();
  visual.scale.setScalar(height);
  visual.position.y = -bounds.min.y * height;
  visual.rotation.y = Math.PI;
  visual.add(model);
  root.add(visual);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });
  const mixer = new THREE.AnimationMixer(model),
    actions = {};
  for (const clip of template.animations)
    actions[clip.name] = mixer.clipAction(clip);
  const idle = actions.Idle_Neutral || actions.Idle;
  idle?.play();
  root.userData = {
    authored: true,
    model,
    visual,
    mixer,
    actions,
    current: idle,
    head: model.getObjectByName("Head"),
    lastPosition: new THREE.Vector3(),
    speaking: false,
  };
  return root;
}
export function animateMara(root, dt, time) {
  if (!root.visible) return;
  const r = root.userData,
    dist = root.position.distanceTo(r.lastPosition);
  r.lastPosition.copy(root.position);
  r.motionSpeed = dt > 0 && dist < 0.6 ? dist / dt : 0;
  const walking = dt > 0 && dist / dt > 0.18 && dist < 0.6,
    next = walking ? r.actions.Walk : r.actions.Idle_Neutral || r.actions.Idle;
  if (next && next !== r.current) {
    next.reset().fadeIn(0.22).play();
    r.current?.fadeOut(0.22);
    r.current = next;
  }
  r.mixer.update(dt);
  // Quiet conversation gesture; child dialogue uses the same coherent rig with age-specific proportions.
  if (r.speaking && r.head) r.head.rotateZ(Math.sin(time * 3.4) * 0.013);
}
