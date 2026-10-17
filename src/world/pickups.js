import * as THREE from "../../vendor/three.module.js";
import { ITEMS, STORAGE } from "../data/items.js";
import {addLockerInterior} from './locker-interior.js';
/** Supplies are real, small meshes concealed by openable school storage. No glowing beacons. */
export function addPickups(world) {
  const metal = new THREE.MeshStandardMaterial({
      color: 0xd6c59a,
      metalness: 0.3,
      roughness: 0.43,
      emissive: 0x625235,
      emissiveIntensity: 0.18,
    }),
    red = new THREE.MeshStandardMaterial({ color: 0x702e29, roughness: 0.85 }),
    paper = new THREE.MeshStandardMaterial({
      color: 0xd5c8a7,
      roughness: 0.95,
    });
  function part(root, geo, mat, x, y, z, rx = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    root.add(m);
    return m;
  }
  function pickup(item, id, slot = 0) {
    const root = new THREE.Group();
    root.name = ITEMS[item].name;
    root.userData.item = item;
    if (ITEMS[item].type === "key") {
      const ring = part(
        root,
        new THREE.TorusGeometry(0.047, 0.009, 8, 20),
        metal,
        -0.065,
        0.011,
        0,
        Math.PI / 2,
      );
      part(
        root,
        new THREE.BoxGeometry(0.115, 0.016, 0.019),
        metal,
        0.035,
        0.011,
        0,
      );
      part(
        root,
        new THREE.BoxGeometry(0.028, 0.016, 0.034),
        metal,
        0.068,
        0.011,
        0.013,
      );
      part(
        root,
        new THREE.BoxGeometry(0.1, 0.004, 0.063),
        paper,
        -0.11,
        0.006,
        0.075,
      );
      part(
        root,
        new THREE.TorusGeometry(0.018, 0.003, 5, 12),
        metal,
        -0.08,
        0.015,
        0.046,
        Math.PI / 2,
      );
    } else if (item === "battery") {
      part(
        root,
        new THREE.CylinderGeometry(0.037, 0.037, 0.16, 16),
        metal,
        0,
        0.037,
        0,
        Math.PI / 2,
      );
      part(
        root,
        new THREE.CylinderGeometry(0.038, 0.038, 0.085, 16),
        red,
        0,
        0.039,
        -0.035,
        Math.PI / 2,
      );
    } else if (item === "fuse") {
      part(
        root,
        new THREE.CylinderGeometry(0.027, 0.027, 0.125, 16),
        paper,
        0,
        0.028,
        0,
        Math.PI / 2,
      );
      for (const z of [-0.055, 0.055])
        part(
          root,
          new THREE.CylinderGeometry(0.029, 0.029, 0.025, 16),
          metal,
          0,
          0.029,
          z,
          Math.PI / 2,
        );
    } else {
      for (const side of [-1, 1]) {
        part(
          root,
          new THREE.BoxGeometry(0.032, 0.024, 0.34),
          red,
          side * 0.08,
          0.02,
          0.11,
          0,
          side * 0.14,
        );
        part(
          root,
          new THREE.BoxGeometry(0.03, 0.034, 0.19),
          metal,
          side * 0.035,
          0.028,
          -0.11,
          0,
          -side * 0.24,
        );
      }
      part(
        root,
        new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12),
        metal,
        0,
        0.025,
        -0.045,
      );
    }
    world.scene.add(root);
    world.interactables.push({
      id,
      label: "Take " + ITEMS[item].name,
      mesh: root,
      type: "pickup",
      item,
      slot,
      position: root.position.clone(),
      enabled: true,
    });
    return root;
  }
  const storage = [];
  function container(item, data, index) {
    const [x, z] = data.slots[index],
      locker = data.kind === "locker";
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = data.rotation;
    world.scene.add(root);
    const h = locker ? 2.2 : 1.08,
      w = locker ? 0.72 : 0.86,
      d = 0.62,
      paint = new THREE.MeshStandardMaterial({
        color: locker ? 0x37493e : 0x514c3d,
        roughness: 0.96,
      });
    function panel(width, height, depth, x, y, z, parent = root) {
      const mesh = part(
        parent,
        new THREE.BoxGeometry(width, height, depth),
        paint.clone(),
        x,
        y,
        z,
      );
      const variants=locker?Object.fromEntries(['ruined','normal','memory','burned','distorted'].map(state=>[state,{material:{map:null,bumpMap:null,roughness:.94,metalness:.06,envMapIntensity:.04}}])):null;
      world.env?.register(mesh, locker ? "locker" : "desk", data.room,variants);
      return mesh;
    }
    panel(w, h, 0.04, 0, h / 2, -d / 2);
    panel(0.04, h, d, -w / 2, h / 2, 0);
    panel(0.04, h, d, w / 2, h / 2, 0);
    panel(w, 0.04, d, 0, 0.025, 0);
    panel(w, 0.05, d, 0, h, 0);
    const tray = new THREE.Group(),
      front = new THREE.Group();
    root.add(tray);
    root.add(front);
    if (locker) {
      panel(w - 0.07, 0.035, d - 0.04, 0, 0.88, 0);
      tray.position.set(0, 0.91, 0);
      addLockerInterior(root,w,h,d,{shelf:.88});
      const hook=part(root,new THREE.CylinderGeometry(.006,.006,.09,8),metal,.06,1.51,-.221,Math.PI/2);
      const lip=part(root,new THREE.CylinderGeometry(.006,.006,.034,8),metal,.06,1.526,-.177);
      lip.name="Upturned key hook";
      hook.name="Locker key hook";
      front.position.set(-w / 2, 0, d / 2 + 0.015);
      panel(w - 0.03, h - 0.08, 0.035, w / 2, h / 2, 0, front);
      for (const y of [1.73, 1.81, 1.89])
        part(
          front,
          new THREE.BoxGeometry(0.3, 0.014, 0.01),
          metal,
          w / 2,
          y,
          0.021,
        );
      part(
        front,
        new THREE.BoxGeometry(0.04, 0.17, 0.04),
        metal,
        w - 0.11,
        1.0,
        0.025,
      );
    } else {
      tray.position.set(0, 0.63, 0);
      panel(w - 0.08, 0.035, d - 0.05, 0, 0.015, 0, tray);
      panel(0.03, 0.18, d - 0.05, -w / 2 + 0.055, 0.09, 0, tray);
      panel(0.03, 0.18, d - 0.05, w / 2 - 0.055, 0.09, 0, tray);
      panel(w - 0.08, 0.18, 0.03, 0, 0.09, -d / 2 + 0.04, tray);
      front.position.set(0, 0.73, d / 2 + 0.025);
      panel(w - 0.06, 0.24, 0.045, 0, 0, 0, front);
      part(front, new THREE.BoxGeometry(0.21, 0.025, 0.04), metal, 0, 0, 0.039);
      // A single moving drawer fits between a fixed top rail and the lower cupboard.
      panel(w - 0.04, 0.18, 0.045, 0, .965, d / 2 + 0.025);
      panel(w - 0.04, 0.52, 0.045, 0, .295, d / 2 + 0.025);
      const liner=part(tray,new THREE.BoxGeometry(w-.15,.006,d-.12),paper,0,.037,.015);
      liner.name='Drawer bottom liner';
      for(const side of [-1,1]){
        const rail=part(root,new THREE.BoxGeometry(.018,.035,d-.07),metal,side*(w/2-.055),.655,0);
        rail.name='Drawer runner';
      }
    }
    if (index % 2 === 0) {
      const forgotten = part(
        tray,
        new THREE.BoxGeometry(0.12, 0.025, 0.17),
        paper,
        -0.23,
        0.07,
        -0.12,
      );
      forgotten.rotation.y = 0.17;
      forgotten.name='Forgotten folded paper';
    } else {
      const pencil = part(
        tray,
        new THREE.CylinderGeometry(0.006, 0.006, 0.19, 8),
        red,
        -0.16,
        0.04,
        -0.06,
      );
      pencil.rotation.z = Math.PI / 2;
    }
    // The frame is solid even though it has a visual cavity; drawers extend into a clear approach aisle.
    const obstacle = world.box(
      x,
      h / 2,
      z,
      Math.abs(Math.cos(data.rotation)) * w +
        Math.abs(Math.sin(data.rotation)) * d,
      h,
      Math.abs(Math.sin(data.rotation)) * w +
        Math.abs(Math.cos(data.rotation)) * d,
      0,
      "desk",
      data.room,
      true,
    );
    obstacle.visible = false;
    obstacle.userData.collisionOnly = true;
    root.userData.obstacle = obstacle.userData.obstacle;
    front.userData.obstacle = obstacle.userData.obstacle;
    root.updateMatrixWorld(true);
    const t = {
      id: `storage_${item}_${index}`,
      type: "container",
      kind: data.kind,
      label: `Search ${locker ? "locker" : "drawer"} ${index + 1}`,
      mesh: front,
      root,
      tray,
      position: front.getWorldPosition(new THREE.Vector3()),
      open: false,
      amount: 0,
      storageItem: item,
      index,
      room: data.room,
      enabled: true,
      rotation: data.rotation,
      obstacle: obstacle.userData.obstacle,
    };
    t.approach = new THREE.Vector3(0, 0, 1.48)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), data.rotation)
      .add(root.position);
    world.interactables.push(t);
    storage.push(t);
    return t;
  }
  for (const [item, data] of Object.entries(STORAGE)) {
    for (let i = 0; i < data.slots.length; i++) container(item, data, i);
    pickup(item, "item_" + item);
  }
  const emergency=container('flashlight',{kind:'locker',room:'lobby',rotation:Math.PI/2,slots:[[-6.15,10.3]]},0);
  emergency.fixed=true;emergency.storageItem=null;emergency.id='storage_emergencyFlashlight';emergency.label='Open emergency equipment locker';
  const torch=new THREE.Group();torch.name='Emergency flashlight';
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.23,20),new THREE.MeshStandardMaterial({color:0x263331,metalness:.55,roughness:.58}));
  body.rotation.x=Math.PI/2;torch.add(body);
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.065,.038,.075,24),metal);head.rotation.x=Math.PI/2;head.position.z=.14;torch.add(head);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.055,24),new THREE.MeshStandardMaterial({color:0xc8d6c9,metalness:.3,roughness:.18}));lens.position.z=.18;torch.add(lens);
  torch.position.set(0,.08,.06);torch.rotation.y=.4;emergency.tray.add(torch);
  world.interactables.push({id:'item_flashlight',type:'pickup',item:'flashlight',label:'Take the emergency flashlight',mesh:torch,position:new THREE.Vector3(),container:emergency,fixed:true,available:true,enabled:false});
  const redMarker=new THREE.PointLight(0xe58c65,.12,2.8,2);redMarker.position.set(-5.7,1.9,10.3);world.scene.add(redMarker);
  const label=world.textPlane?.('EMERGENCY\nEQUIPMENT',-5.81,1.95,10.3,.45,.28,Math.PI/2,'#bfbca9','#31413a',24);
  if(label){world.scene.updateMatrixWorld(true);emergency.mesh.attach(label);}
  return storage;
}
/** Kept here so tests and the main loop use the same physical opening motion. */
export function animateStorage(storage, dt) {
  for (const t of storage) {
    t.amount = THREE.MathUtils.lerp(
      t.amount,
      t.open ? 1 : 0,
      1 - Math.exp(-dt * 8),
    );
    if (t.animation === "lid") t.mesh.rotation.x = -t.amount * 1.75;
    else if (t.kind === "locker") t.mesh.rotation.y = -t.amount * Math.PI * 0.57;
    else {
      t.tray.position.z = t.amount * 0.38;
      t.mesh.position.z = 0.335 + t.amount * 0.38;
    }
    t.root.updateMatrixWorld(true);
    t.mesh.getWorldPosition(t.position);
  }
}
