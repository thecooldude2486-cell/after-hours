import {addWestWing} from "./west-wing.js";
import {addLockerInterior} from './locker-interior.js';
import {createFusePanel} from './fuse-panel.js';
import {addSchoolEchoes} from "./school-echoes.js";
import {addCRTSecret} from "./crt-secret.js";
import {ageNote} from "./aged-paper.js";
import { pushDoors, releaseDoor, updatePushDoor, doorShape, segmentBlocked } from "./push-doors.js";
import { addSecrets, animateSecrets } from "./secrets.js";
import { addRoomDecay } from "./room-decay.js";
import { addSchoolArt } from "./school-art.js";
import { physicalBoxGeometry, surfaceVariants } from "./surface-materials.js";
import { CLASSROOM_MEMORY_CAST } from "../data/classroom.js";
import { addPickups, animateStorage } from "./pickups.js";
import * as THREE from "../../vendor/three.module.js";
import { createCharacter, animateCharacter } from "./characters.js";
import { EnvironmentSystem } from "../systems/environment.js";

function texture(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = kind === "floor" ? "#b2b4ac" : "#d1d0c2";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const v = 80 + Math.random() * 135;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.14})`;
    g.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 10 + 1,
      Math.random() * 5 + 1,
    );
  }
  if (kind === "floor") {
    g.strokeStyle = "#6c736855";
    g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 256);
      g.moveTo(0, i);
      g.lineTo(256, i);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 32; i++) {
      g.fillStyle = "#333a2c20";
      g.fillRect(
        Math.random() * 256,
        Math.random() * 256,
        1,
        Math.random() * 90 + 5,
      );
    }
    g.strokeStyle = "#39423744";
    g.beginPath();
    g.moveTo(60, 0);
    g.lineTo(45, 80);
    g.lineTo(70, 126);
    g.lineTo(63, 200);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === "floor" ? 3 : 2, kind === "floor" ? 3 : 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function createSchool(renderer, config) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080f13);
  scene.fog = new THREE.FogExp2(0x080f13, 0.026);
  const ambient = new THREE.HemisphereLight(0x637a8c, 0x111713, 0.52);
  scene.add(ambient);
  scene.environmentIntensity = 0.55;
  const env = new EnvironmentSystem(scene, ambient, config),
    obstacles = [],
    interactables = [],
    lights = [],
    hideSpots = [],
    ambientLockers = [],
    doors = [],
    rain = [];
  let powerFailure=false;
  const reflection = (friendly) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = friendly ? "#83918f" : "#15252a";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = friendly ? "#e7e7d4" : "#52605b";
    ctx.fillRect(18, 25, 65, 17);
    ctx.fillRect(150, 28, 65, 15);
    ctx.fillStyle = friendly ? "#41493d" : "#080e11";
    ctx.fillRect(0, 80, 256, 48);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  };
  env.reflectionMaps = {
    friendly: reflection(true),
    ruined: reflection(false),
  };
  const wallTexture = texture("wall"),
    floorTexture = texture("floor");
  const material = (color, options = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...options });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  function box(
    x,
    y,
    z,
    w,
    h,
    d,
    color,
    role = null,
    room = "school",
    solid = false,
    options = {},
  ) {
    const m = new THREE.Mesh(
      physicalBoxGeometry(geo, w, h, d, role),
      material(color, {
        map:
          role === "wall"
            ? wallTexture
            : role === "floor"
              ? floorTexture
              : null,
        ...options,
      }),
    );
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.receiveShadow = true;
    solid = solid || (role === "desk" && w > 0.7 && d > 0.4);
    m.castShadow = solid;
    scene.add(m);
    if (role) env.register(m, role, room, surfaceVariants(role));
    if (solid) {
      const o = {
        minY: y - h / 2,
        maxY: y + h / 2,
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        enabled: true,
        mesh: m,
      };
      obstacles.push(o);
      m.userData.obstacle = o;
    }
    return m;
  }
  function wall(x, z, w, d) {
    box(x, 1.9, z, w, 3.8, d, 0x666d65, "wall", "school", true);
    box(x, 0.6, z, w + 0.015, 0.82, d + 0.015, 0x223c35, "trim");
    box(x, 1.05, z, w + 0.025, 0.055, d + 0.025, 0x878a75);
    box(x, 0.08, z, w + 0.05, 0.16, d + 0.05, 0x192c27);
  }
  function segmentX(x, z1, z2) {
    if (z2 > z1) wall(x, (z1 + z2) / 2, 0.23, z2 - z1);
  }
  function segmentZ(z, x1, x2) {
    if (x2 > x1) wall((x1 + x2) / 2, z, x2 - x1, 0.23);
  }
  function floor(x, z, w, d, room = "school") {
    box(x, -0.12, z, w, 0.24, d, 0x373e3d, "floor", room);
    box(x, 3.87, z, w, 0.16, d, 0x646a62, "ceiling", room);
  }
  floor(0, -30, 6, 64);
  floor(0, 7, 14, 10);
  floor(-9, -18.5, 12, 13, "classroom");
  floor(9, -18.5, 12, 13, "office");
  floor(-9, -38.5, 12, 13, "archive");
  floor(9, -38.5, 12, 13, "phone");
  floor(17.5, -44, 5, 36, "maintenance");
  floor(1.5, -71, 37, 18, "gym");
  floor(0, 17, 14, 10, "outside");
  // Classroom openings are real gaps in colliders, not trigger-only passages.
  for (const x of [-3, 3]) {
    if(x===-3){segmentX(x,-62,-51.5);segmentX(x,-48.5,-38);}
    else segmentX(x, -62, -38);
    segmentX(x, -35, -18);
    segmentX(x, -15, 2);
  }
  for(const [x,z] of [[-3,-16.5],[3,-36.5]]){
    segmentX(x,z-1.5,z-.6);segmentX(x,z+.6,z+1.5);
    box(x,3,z,.23,1.6,1.2,0x666d65,'wall','school',true);
    for(const side of [-1,1])box(x,1.1,z+side*.59,.31,2.2,.06,0x5b6659,'trim','school',true);
    box(x,2.17,z,.31,.08,1.24,0x5b6659,'trim');
  }
  for (const x of [-15, 15]) {
    if (x < 0) { segmentX(x, -25, -24.5); segmentX(x, -22.7, -12); }
    else { segmentX(x, -25, -22.9); segmentX(x, -21.1, -12); }
    if (x < 0) { segmentX(x, -45, -40.9); segmentX(x, -39.1, -32); }
    else {
      segmentX(x, -45, -39);
      segmentX(x, -36, -32);
    }
  }
  for (const [z, a, b] of [
    [-12, -15, -3],
    [-25, -15, -3],
    [-32, -15, -3],
    [-45, -15, -3],
    [-12, 3, 15],
    [-25, 3, 15],
    [-32, 3, 15],
    [-45, 3, 15],
  ])
    segmentZ(z, a, b);
  segmentX(20, -80, -53.4);
  segmentX(20, -51.6, -26);
  segmentX(15, -62, -45);
  segmentZ(-26, 15, 20);
  segmentZ(-62, -17, -1.5);
  segmentZ(-62, 1.5, 15);
  segmentZ(-62, 18, 20);
  segmentX(-17, -80, -62);
  segmentZ(-80, -17, 20);
  segmentX(-7, 2, 22);
  segmentX(7, 2, 22);
  segmentZ(2, -7, -3);
  segmentZ(2, 3, 7);
  segmentZ(12, -7, -1.65);
  segmentZ(12, 1.65, 7);
  segmentZ(22, -7, 7);
  // Exterior sky opening, entrance beyond rain-covered windows.
  const outsideRoof = env.entries.filter(
    (e) => e.room === "outside" && e.role === "ceiling",
  );
  outsideRoof.forEach((e) => (e.mesh.visible = false));
  function textPlane(
    text,
    x,
    y,
    z,
    w = 2,
    h = 0.6,
    rotation = 0,
    color = "#c3c5aa",
    bg = "#233b35",
    size = 32,
  ) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = Math.max(128, Math.round((512 * h) / w));
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color;
    g.font = `${size}px Arial`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    text
      .split("\n")
      .forEach((t, i, a) =>
        g.fillText(
          t,
          256,
          c.height / 2 + (i - (a.length - 1) / 2) * (size + 7),
          480,
        ),
      );
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(c),
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotation;
    scene.add(m);
    return m;
  }
  textPlane("EAST WING   ↑", 0, 2.9, -28, 2.4, 0.38, 0);
  textPlane("GYMNASIUM   ↑", 0, 2.9, -53, 2.5, 0.38, 0);
  textPlane(
    "EXIT",
    0,
    3.1,
    11.83,
    1.3,
    0.37,
    Math.PI,
    "#b5cfb1",
    "#244133",
    52,
  );
  textPlane(
    "AFTER HOURS\nALL VISITORS REPORT TO OFFICE",
    -6.85,
    2,
    6,
    2.3,
    0.8,
    Math.PI / 2,
    "#bec4b3",
    "#1f3230",
    25,
  );
  // Mount on the corridor face, above the 2.2 m door frame.
  for (const [label, x, z, rotation] of [
    ["CLASSROOM 04", -2.86, -16.5, Math.PI / 2],
    ["CLASSROOM 08", 2.86, -36.5, -Math.PI / 2],
  ]) {
    const sign = textPlane(label, x, 2.43, z, 1.5, 0.34, rotation,
      "#eee8cc", "#162a26", 52);
    sign.name = label + " doorway sign";
    sign.userData.classroomSign = true;
    sign.material.map.colorSpace = THREE.SRGBColorSpace;
    sign.material.emissive.set(0xeee8cc);
    sign.material.emissiveMap = sign.material.map;
    sign.material.emissiveIntensity = 0.12;
  }
  textPlane("RECORDS", -3.13, 2.95, -36.5, 2, 0.4, Math.PI / 2);
  textPlane("MAINTENANCE", 15.12, 2.9, -37.5, 2, 0.4, -Math.PI / 2);
  // Fluorescent housings and broken ceiling panels.
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xabbcac,
    emissive: 0xa9c8b7,
    emissiveIntensity: 1.1,
  });
  for (let z = 6; z > -70; z -= 9) {
    box(0, 3.73, z, 1.7, 0.09, 0.5, 0x263834);
    const tube = new THREE.Mesh(geo, fixtureMat.clone());
    tube.scale.set(1.35, 0.055, 0.17);
    tube.position.set(0, 3.65, z);
    scene.add(tube);
    lights.push({ tube, z, base: 1.1 });
  }
  for (const [x, z] of [
    [0, 5],
    [0, -13],
    [0, -31],
    [0, -49],
    [0, -66],
    [-9, -18],
    [9, -38],
  ]) {
    const l = new THREE.PointLight(0xa6c4b8, 6, 19, 1.8);
    l.position.set(x, 3.2, z);
    scene.add(l);
    lights.push({ light: l, z, base: 6 });
  }
  const exterior = new THREE.DirectionalLight(0x9fb9d9, 0.8);
  exterior.position.set(-10, 7, -20);
  scene.add(exterior);
  function windowAt(x, z, rotation) {
    const pane = box(
      x,
      2.12,
      z,
      0.08,
      1.8,
      3.25,
      0x496573,
      null,
      "school",
      false,
      {
        emissive: 0x273e4f,
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0.32,
      },
    );
    box(x, 2.12, z, 0.11, 0.05, 3.3, 0x22382f);
    box(x, 2.12, z, 0.11, 1.88, 0.055, 0x22382f);
    box(x, 1.17, z, 0.35, 0.12, 3.5, 0x566256);
    for (let i = 0; i < 18; i++) {
      const streak = box(
        x + (x < 0 ? 0.07 : -0.07),
        2.1 + Math.random() * 0.9,
        z - 1.5 + Math.random() * 3,
        0.015,
        0.25 + Math.random() * 0.6,
        0.012,
        0xa1bdc6,
        null,
        "school",
        false,
        {
          transparent: true,
          opacity: 0.25,
          emissive: 0x6b8f9a,
          emissiveIntensity: 0.3,
        },
      );
      rain.push(streak);
    }
    env.register(pane, "window", "school", {
      normal: {
        material: {
          emissive: new THREE.Color(0xa4bbc4),
          emissiveIntensity: 0.65,
        },
      },
      memory: {
        material: {
          emissive: new THREE.Color(0xa4bbc4),
          emissiveIntensity: 0.65,
        },
      },
      ruined: {
        material: {
          emissive: new THREE.Color(0x273e4f),
          emissiveIntensity: 0.35,
        },
      },
      burned: {
        material: {
          emissive: new THREE.Color(0x273e4f),
          emissiveIntensity: 0.35,
        },
      },
      distorted: {
        material: {
          emissive: new THREE.Color(0x273e4f),
          emissiveIntensity: 0.35,
        },
      },
    });
    return pane;
  }
  for (const z of [-16, -21, -36, -41]) windowAt(-14.84, z);
  for (const z of [-16, -21]) windowAt(14.84, z);
  function target(id, label, mesh, type = "prop", extra = {}) {
    const t = {
      id,
      label,
      mesh,
      type,
      position: mesh.position.clone(),
      enabled: true,
      ...extra,
    };
    interactables.push(t);
    return t;
  }
  function locker(x, z, id = null) {
    const direction = x < 0 ? 1 : -1;
    const body = box(
      x,
      1.27,
      z,
      0.62,
      2.54,
      0.8,
      0x314944,
      "locker",
      "school",
      true,
    );
    // Keep the collision body, but render a real hollow shell for every opening locker.
    body.visible = false;
    body.userData.collisionOnly = true;
    {
      box(x - direction * 0.3, 1.27, z, 0.045, 2.54, 0.8, 0x213d35, "locker");
      for (const dz of [-0.39, 0.39])
        box(x, 1.27, z + dz, 0.62, 2.54, 0.035, 0x314944, "locker");
      for (const y of [0.04, 2.52])
        box(x, y, z, 0.62, 0.06, 0.8, 0x314944, "locker");
      box(x,1.02,z,.54,.025,.7,0x87907c);
    }
    const fittings=new THREE.Group();fittings.name="Corridor locker interior";fittings.position.set(x,0,z);fittings.rotation.y=direction*Math.PI/2;scene.add(fittings);
    addLockerInterior(fittings,.8,2.54,.62);
    if (id === "bracelet") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.016, 8, 20),
        material(0x988663),
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x + direction * 0.19, 1.26, z);
      scene.add(ring);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5,
          bead = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 8, 6),
            material(i % 2 ? 0xbba977 : 0x658e83),
          );
        bead.position.set(
          x + direction * 0.19,
          1.26 + Math.cos(a) * 0.13,
          z + Math.sin(a) * 0.13,
        );
        scene.add(bead);
      }
    }
    const face = box(
      x + direction * 0.325,
      1.3,
      z,
      0.035,
      2.42,
      0.74,
      0x3b5149,
      "locker",
    );
    const doorParts=[face];
    for (const y of [1.93, 2.02, 2.11])
      doorParts.push(box(x + direction * 0.35, y, z, 0.02, 0.022, 0.38, 0x132925));
    doorParts.push(box(x + direction * 0.365, 1.17, z - 0.22, 0.045, 0.15, 0.045, 0x88928c));
    doorParts.push(textPlane(
      id === "bracelet" ? "17" : String(10 + Math.floor(Math.abs(z))),
      x + direction * 0.355,
      1.65,
      z,
      0.33,
      0.2,
      (direction * Math.PI) / 2,
      "#c3c4a9",
      "#394b43",
      50,
    ));
    if (id) {
      const obj = target(
        id,
        id === "bracelet" ? "Open Mara’s locker" : "Hide in locker",
        face,
        id === "bracelet" ? "note" : "hide",
        { note: id === "bracelet" ? "bracelet" : null },
      );
      if (id === "bracelet") {
        const pieces = doorParts;
        const hinge = new THREE.Group();
        hinge.position.set(x + direction * 0.325, 0, z - 0.37);
        scene.add(hinge);
        scene.updateMatrixWorld(true);
        for (const part of pieces) hinge.attach(part);
        obj.hinge = hinge;
        obj.openAngle = (direction * Math.PI) / 2;
      }
      if (id !== "bracelet") {
        obj.hide = {
          x: x - direction * 0.28,
          z,
          y: 1.45,
          yaw: (-direction * Math.PI) / 2,
        };
        hideSpots.push(obj);
      }
    }
    if (!id) {
      const pieces = doorParts;
      const hinge = new THREE.Group();
      hinge.position.set(x + direction * 0.325, 0, z - 0.37);
      scene.add(hinge);
      scene.updateMatrixWorld(true);
      for (const piece of pieces) hinge.attach(piece);
      const collider = { enabled: false, mesh: face, minY: 0.09, maxY: 2.51 };
      obstacles.push(collider);
      const record={
        x,
        z,
        direction,
        hinge,
        face,
        collider,
        elapsed: 0,
        playing: false,
        manualOpen:false,
        manualAmount:0,
      };
      record.target=target('inspectLocker_'+ambientLockers.length,'Open locker',face,'lockerDoor',{locker:record});
      ambientLockers.push(record);
    }
  }
  for (let z = -4; z >= -28; z -= 1.1) {
    if (
      (z > -18.9 && z < -14.1) ||
      Math.abs(z + 7.3) < 0.6 ||
      Math.abs(z + 25.3) < 0.6
    )
      continue;
    locker(-2.57, z);
    locker(2.57, z);
  }
  // Guaranteed story locker / hiding target independent of floating-point loop increments.
  locker(-2.57, -7.3, "bracelet");
  locker(2.57, -25.3, "hideHall");
  locker(17, -47, "hideEast");
  function desk(x, z, room = "classroom", hiding = false) {
    const top = box(x, 0.77, z, 1.3, 0.09, 0.8, 0x493f30, "desk", room, true);
    top.userData.obstacle.kind = "desk";
    for (const dx of [-0.53, 0.53])
      for (const dz of [-0.3, 0.3])
        box(x + dx, 0.37, z + dz, 0.045, 0.74, 0.045, 0x414c44);
    box(x, 0.42, z + 0.75, 0.55, 0.075, 0.5, 0x504938, "desk", room, true);
    box(x, 0.73, z + 1, 0.55, 0.5, 0.075, 0x504938, "desk", room, true);
    for (const dx of [-0.2, 0.2])
      for (const dz of [0.55, 0.93])
        box(x + dx, 0.2, z + dz, 0.025, 0.4, 0.025, 0x333d35);
    if (hiding) {
      const t = target("hideDesk_" + room, "Hide under desk", top, "hide", {
        hide: { x, z: z - 0.1, y: 0.56, yaw: Math.PI },
      });
      hideSpots.push(t);
    }
    return top;
  }
  let childhoodDesk;
  for (const [cx, cz, room] of [
    [-9, -18, "classroom"],
    [9, -38, "phone"],
  ]) {
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const d = desk(
          cx + (col - 1) * 2.6,
          cz + (row - 1) * 2.5,
          room,
          row === 2 && col === 2,
        );
        if (room === "classroom" && row === 1 && col === 1) childhoodDesk = d;
      }
    const boardZ=room==='classroom'?-24.84:-44.84;
    box(cx, 2.05, boardZ-.055, 6, 1.65, 0.1, 0x172f2a);
    const boardText=textPlane(
      room === "classroom" ? "Please hand in your homework." : "",
      cx,
      2.05,
      boardZ+.005,
      5.7,
      1.4,
      0,
      "#9ba797",
      "#203832",
      27,
    );
    env.register(boardText,"classroom-chalk",room,{
      normal:{visible:true},memory:{visible:true},ruined:{visible:false},burned:{visible:false},distorted:{visible:false}
    });
    box(cx, 2.9, boardZ, 0.4, 0.08, 0.12, 0xc4bda0);
    desk(cx + 2, cz - 3.5, room);
  }
  // A clock without a working hand makes the memory threshold readable.
  const clock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.075, 24),
    material(0xd6d3b7),
  );
  clock.rotation.x = Math.PI / 2;
  clock.position.set(0, 2.6, -47.8);
  scene.add(clock);
  textPlane("3:17", 0, 2.6, -47.74, 0.48, 0.22, 0, "#26362f", "#d0cfb5", 70);
  target("clock", "Remember the afternoon", clock, "story");
  function sheet(id, x, y, z, room, label, body) {
    const m = textPlane(body, x, y, z, 0.8, 0.55, 0, "#38483a", "#d3c9aa", 25);
    m.rotation.x = -Math.PI / 2;
    if (id === "photo" || id === "drawing") {
      m.geometry.dispose();
      m.geometry = new THREE.PlaneGeometry(0.86, 0.645);
      m.userData.imagePath =
        id === "photo"
          ? "assets/images/first-day.png"
          : "assets/images/mara-drawing.png";
      if (typeof document.createElementNS === "function")
        new THREE.TextureLoader().load(m.userData.imagePath, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          m.material.map?.dispose();
          m.material.map = texture;
          m.material.needsUpdate = true;
        });
    }
    if(id!=='photo'&&id!=='drawing')ageNote(m,body,x+z);
    env.register(m, "paper", room);
    target(id, label, m, "note", { note: id });
    return m;
  }
  sheet(
    "drawing",
    -9,
    0.825,
    -15.5,
    "classroom",
    "Look at the drawing",
    "ME + ELI\nVS THE WORLD",
  );
  sheet(
    "note",
    -6.4,
    0.825,
    -20.5,
    "classroom",
    "Read the teacher’s note",
    "MARA WARD",
  );
  sheet(
    "photo",
    -11.6,
    0.825,
    -20.5,
    "classroom",
    "Look at the photograph",
    "FIRST DAY",
  );
  // Noticeboard, paper corners, water bucket and fallen tiles.
  box(-6.82, 1.95, 4, 0.12, 1.65, 2.2, 0x6b6045);
  textPlane(
    "SCHOOL DISCO\nFRIDAY · 7 PM",
    -6.7,
    2.05,
    3.8,
    0.8,
    1,
    Math.PI / 2,
    "#6b4b40",
    "#b9ad8b",
    28,
  );
  for (let i = 0; i < 18; i++) {
    const m = box(
      (Math.random() - 0.5) * 4,
      0.018,
      -Math.random() * 55,
      0.25 + Math.random() * 0.4,
      0.01,
      0.3,
      0x8c9385,
    );
    m.rotation.y = Math.random() * 6;
    env.register(m, "debris", "school", {
      normal: { visible: false },
      memory: { visible: false },
    });
  }
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.21, 0.4, 16, 1, true),
    material(0x59645e, { side: THREE.DoubleSide, metalness: 0.5 }),
  );
  bucket.position.set(1.8, 0.2, -11);
  scene.add(bucket);
  env.register(bucket, "water-bucket", "school", {
    normal: { visible: false },
    memory: { visible: false },
  });
  for (let i = 0; i < 14; i++) {
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.4 + Math.random() * 0.5, 20),
      material(0x334957, {
        roughness: 0.1,
        metalness: 0.6,
        transparent: true,
        opacity: 0.5,
      }),
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set((Math.random() - 0.5) * 3, 0.014, -Math.random() * 55);
    puddle.scale.y = 0.4;
    scene.add(puddle);
    env.register(puddle, "puddle", "school", {
      memory: { visible: false },
      normal: { visible: false },
    });
  }
  function cassette(x, z) {
    const base = box(x, 0.97, z, 0.65, 0.18, 0.4, 0x343e38);
    box(x, 0.98, z + 0.21, 0.49, 0.1, 0.025, 0x12251e);
    for (const dx of [-0.15, 0.15]) {
      const reel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.058, 0.02, 16),
        material(0x9f9982),
      );
      reel.rotation.x = Math.PI / 2;
      reel.position.set(x + dx, 0.985, z + 0.23);
      scene.add(reel);
    }
    target("cassette", "Play the cassette", base, "audio");
  }
  box(-5.1, 0.43, -22.8, 1.5, 0.85, 0.8, 0x4a483c, "desk", "classroom", true);
  cassette(-5.1, -22.8);
  function phone(x, z, id) {
    box(x, 0.83, z, 1.4, 1.65, 0.8, 0x494c3e, "desk", "phone", true);
    const base = box(x, 1.75, z, 0.55, 0.16, 0.5, 0x26332d);
    box(x, 1.88, z - 0.1, 0.61, 0.12, 0.16, 0x1e2924);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++)
        box(
          x + (col - 1) * 0.07,
          1.844,
          z + 0.01 + row * 0.07,
          0.048,
          0.02,
          0.04,
          0x949982,
        );
    target(id, "Answer the classroom telephone", base, "audio");
  }
  phone(12, -41, "phone");
  box(10, 0.6, -43, 1.3, 1.2, 0.8, 0x494c3e, "desk", "phone", true);
  sheet(
    "family",
    10,
    1.218,
    -43,
    "phone",
    "Read the remembered voices",
    "EIGHT YEARS",
  );
  box(5, 1.1, -21, 2.2, 0.1, 0.9, 0x4b4c3f, "desk", "office", true);
  for (const dx of [-0.9, 0.9])
    for (const dz of [-0.35, 0.35])
      box(5 + dx, 0.525, -21 + dz, 0.055, 1.05, 0.055, 0x353c33);
  const crt = box(5, 1.45, -21, 0.7, 0.6, 0.6, 0x858b78);
  const crtScreen = box(5, 1.48, -20.67, 0.55, 0.4, 0.035, 0x101917, null, "school", false, {
    emissive: 0x46725f,
    emissiveIntensity: 0,
  });
  const crtGlow = new THREE.PointLight(0x83bba8, 0, 6, 2);
  crtGlow.position.set(5,1.5,-20.4);scene.add(crtGlow);
  // A small bounced spill at the office entrance, rather than a global hallway change.
  const crtSpill = new THREE.PointLight(0x83bba8, 0, 3.8, 2);
  crtSpill.position.set(2.72,1.45,-16.7);scene.add(crtSpill);
  const crtTarget=target("crt", "Switch CRT monitor on", crt, "switch", {open:false,screen:crtScreen,glow:crtGlow,spill:crtSpill});
  function setCRT(on) {
    crtTarget.open = !!on;
    crtScreen.material.emissiveIntensity = on ? 0.5 : 0;
    crtScreen.material.color.setHex(on ? 0x23433b : 0x101917);
    crtGlow.intensity = on ? 0.62 : 0;
    crtSpill.intensity = on ? 0.14 : 0;
    crtTarget.label = "Switch CRT monitor " + (on ? "off" : "on");
  }
  const drawer=new THREE.Group();drawer.position.set(8,0,-21);scene.add(drawer);
  const drawerWood=material(0x575441),drawerMetal=material(0x93998c,{metalness:.5});
  const dp=(w,h,d,x,y,z,parent=drawer,mat=drawerWood)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;
  };
  dp(.9,.8,.035,0,.4,-.325);dp(.035,.8,.65,-.45,.4,0);dp(.035,.8,.65,.45,.4,0);
  dp(.9,.035,.65,0,.8,0);dp(.9,.035,.65,0,.03,0);dp(.85,.36,.035,0,.22,.34);
  dp(.85,.07,.035,0,.746,.34);
  const drawerTray=new THREE.Group();drawerTray.position.y=.49;drawer.add(drawerTray);
  dp(.8,.025,.59,0,0,0,drawerTray);dp(.025,.17,.59,-.4,.09,0,drawerTray);dp(.025,.17,.59,.4,.09,0,drawerTray);
  dp(.8,.17,.025,0,.09,-.28,drawerTray);dp(.85,.22,.035,0,.08,.34,drawerTray);
  dp(.21,.025,.04,0,.08,.375,drawerTray,drawerMetal);
  const drawerPhoto=textPlane('FIRST DAY',8,.527,-20.92,.24,.18,0,'#3c3b30','#bab59b',25);drawerPhoto.rotation.x=-Math.PI/2;
  scene.updateMatrixWorld(true);drawerTray.attach(drawerPhoto);
  const drawerCollider=box(8,.4,-21,.94,.8,.7,0,null,'office',true);drawerCollider.visible=false;drawerCollider.userData.collisionOnly=true;
  const legacyDrawer=target('drawer','Open desk drawer',drawer,'drawer',{note:'photo',drawerTray,position:new THREE.Vector3(8,.6,-20.65)});
  const switchMesh = box(3.17, 1.5, -34, 0.04, 0.18, 0.12, 0xc4c8ae);
  target("switch", "Toggle corridor lights", switchMesh, "switch");
  for (const z of [-50, -55]) {
    box(19.6, 1.35, z, 0.3, 1.8, 1.2, 0x39463e, "locker", "maintenance", true);
    box(19.39, 1.4, z, 0.04, 0.7, 0.55, 0x272f29);
  }
  box(17.5, 0.82, -52, 2, 0.12, 1.1, 0x444237, "desk", "maintenance");
  sheet(
    "fault",
    17.5,
    0.9,
    -52,
    "maintenance",
    "Read the fire record",
    "EAST WING\nCORRECTED REPORT",
  );
  box(-11, 0.8, -39, 2, 0.1, 1.1, 0x494a39, "desk", "archive");
  sheet(
    "vale",
    -11,
    0.88,
    -39,
    "archive",
    "Read Mrs. Vale’s record",
    "MRS. VALE\nSTAFF RECORD",
  );
  for (let i = 0; i < 3; i++) {
    box(
      -14.1,
      1.2,
      [-34, -37, -42.3][i],
      0.8,
      2.4,
      1.8,
      0x3e4a41,
      "locker",
      "archive",
      true,
    );
    for (let y = 0.6; y < 2; y += 0.5)
      box(-13.64, y, [-34, -37, -42.3][i], 0.04, 0.34, 1.65, 0x666654);
  }
  box(2, 0.6, -74, 1.2, 1.2, 0.6, 0x514b38, "desk", "gym");
  sheet(
    "waiting",
    2,
    1.23,
    -74,
    "gym",
    "Read Mara’s notebook",
    "HE’LL COME BACK",
  );
  // Gym court markings, low stage, radiator pipes and folded hoops.
  for (const x of [-8, 8]) box(x, 0.012, -70, 0.05, 0.015, 12, 0x8f8a66);
  for (const z of [-64, -76]) box(0, 0.015, z, 16, 0.02, 0.05, 0x8f8a66);
  box(0, 0.16, -78, 15, 0.32, 3, 0x4a4434, "desk", "gym");
  const hoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.03, 8, 24),
    material(0x8c7253),
  );
  hoop.rotation.x = Math.PI / 2;
  hoop.position.set(0, 3.1, -77);
  scene.add(hoop);
  box(0, 3.4, -77.5, 1.5, 0.9, 0.08, 0x808478);
  function gate(id, x, z, w, label, rotation = 0, height=2.85) {
    const hinge = new THREE.Group();
    hinge.position.set(
      x - (Math.cos(rotation) * w) / 2,
      0,
      z + (Math.sin(rotation) * w) / 2,
    );
    hinge.rotation.y = rotation;
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(w, height, 0.15),
      material(0x344b42),
    );
    leaf.position.set(w / 2, height/2, 0);
    hinge.add(leaf);
    scene.add(hinge);
    const o = {
      minY: 0,
      maxY: 3.8,
      minX: x - (rotation ? 0.16 : w / 2),
      maxX: x + (rotation ? 0.16 : w / 2),
      minZ: z - (rotation ? w / 2 : 0.16),
      maxZ: z + (rotation ? w / 2 : 0.16),
      enabled: true,
    };
    obstacles.push(o);
    const d = { id, hinge, leaf, height, obstacle: o, open: false, angle: 0, rotation, width:w, thickness:.15, amount:0, baseAxis:{x:Math.cos(rotation),z:-Math.sin(rotation)},position:new THREE.Vector3(x,1.3,z),handles:[] };
    const metal = material(0x9b9984,{metalness:.65,roughness:.42});
    if (!['classroomGate','phoneGate'].includes(id)) {
      const lever = new THREE.Mesh(new THREE.BoxGeometry(.15,.025,.035),metal);
      lever.position.set(w*.35,-.06,.1);leaf.add(lever);d.handles.push(lever);
    }
    const keyTurn = new THREE.Group();keyTurn.position.set(w*.35,-.28,.13);leaf.add(keyTurn);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(.018,.018,.07),metal);keyTurn.add(stem);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(.035,.007,8,16),metal);bow.position.z=.05;keyTurn.add(bow);
    keyTurn.visible=false;d.keyTurn=keyTurn;
    doors.push(d);
    target(id, label, leaf, "door", {
      position: new THREE.Vector3(x, 1.4, z),
      door: d,
    });
    return d;
  }
  const front = gate("exit", 0, 12, 3.25, "Try the front doors");
  textPlane(
    "MAIN ENTRANCE",
    0,
    3.24,
    11.77,
    2.7,
    0.26,
    Math.PI,
    "#d1d0b7",
    "#24392e",
    34,
  );
  const latch = gate("latch", 17.5, -34, 4.7, "Locked maintenance door");
  const escapeDoor = gate(
    "escapeDoor",
    15,
    -37.5,
    2.85,
    "Hold E · force the warped door",
    Math.PI / 2,
  );
  escapeDoor.pressure = true;
  const classroomGate = gate(
    "classroomGate",
    -3,
    -16.5,
    1.05,
    "Unlock Classroom 04",
    Math.PI / 2,2.1,
  );
  const phoneGate = gate(
    "phoneGate",
    3,
    -36.5,
    1.05,
    "Unlock Classroom 08",
    Math.PI / 2,2.1,
  );
  for(const door of [classroomGate,phoneGate]){
    const metal=material(0x9b9984,{metalness:.65,roughness:.42});
    for(const side of [-1,1]){
      const plate=new THREE.Mesh(new THREE.BoxGeometry(.055,.2,.012),metal);
      plate.position.set(.36,-.08,side*.085);door.leaf.add(plate);
      const lever=new THREE.Mesh(new THREE.BoxGeometry(.14,.025,.025),metal);
      lever.position.set(.30,-.06,side*.105);door.leaf.add(lever);
      door.handles.push(lever);
      const frame=new THREE.Mesh(new THREE.BoxGeometry(.36,.5,.015),material(0x69766c));
      frame.position.set(0,.44,side*.084);door.leaf.add(frame);
      const glass=new THREE.Mesh(new THREE.BoxGeometry(.30,.44,.008),material(0x7c948c,{roughness:.2,metalness:.2}));
      glass.position.set(0,.44,side*.095);door.leaf.add(glass);
    }
    for(const y of [-.75,0,.75]){
      const hingeDetail=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.09,10),metal);
      hingeDetail.position.set(-.52,y,.01);door.leaf.add(hingeDetail);
    }
  }
  const classDoor = gate("classDoor", 0, -62, 2.9, "Cut the gym padlock");
  const eastGymGate = gate(
    "eastGymGate",
    16.5,
    -62,
    2.9,
    "Cut the gym padlock",
  );
  for (const [door, requires] of [
    [classroomGate, "classroomKey"],
    [phoneGate, "staffKey"],
    [classDoor, "cutters"],
    [eastGymGate, "cutters"],
  ]) {
    door.requires = requires;
    interactables.find((t) => t.id === door.id).requires = requires;
    const padlock = box(0, 0, 0, 0.09, 0.13, 0.04, 0x9c9782);
    scene.remove(padlock);
    door.leaf.add(padlock);
    door.lockVisual=padlock;
    padlock.position.set(
      door.leaf.geometry.parameters.width * 0.35,
      -0.28,
      0.095,
    );
  }
  interactables.find((t) => t.id === "bracelet").requires = "lockerKey";
  interactables.find((t) => t.id === "vale").requires = "recordsKey";
  const fuseBox = box(19.34, 1.5, -50, 0.07, 0.7, 0.55, 0x6e7460);
  target("fuseBox", "Restore school power / install fuse", fuseBox, "power");
  const fusePanel=createFusePanel(scene);
  textPlane("MAINTENANCE POWER", 19.29, 2.05, -50, 1, 0.25, -Math.PI / 2);
  for (const [x, z, y] of [
    [17.5, -52, 0.76],
    [-11, -39, 0.75],
  ])
    for (const dx of [-0.8, 0.8])
      for (const dz of [-0.43, 0.43])
        box(x + dx, y / 2, z + dz, 0.05, y, 0.05, 0x353e34);
  const seat = childhoodDesk;
  target("seat", "Sit beside Mara", seat, "story");
  target(
    "leave",
    "Leave the classroom together",
    box(-3.15, 1.5, -16.5, 0.05, 0.22, 0.14, 0xb3b49c),
    "story",
  );
  const lastPhone = box(0.5, 0.03, 15, 0.17, 0.03, 0.31, 0x121b1b);
  const screen = box(
    0.5,
    0.049,
    15,
    0.13,
    0.004,
    0.24,
    0x46756e,
    null,
    "outside",
    false,
    { emissive: 0x8aa893, emissiveIntensity: 1 },
  );
  lastPhone.add(screen);
  screen.position.set(0, 0.019, 0);
  target("lastPhone", "Listen to the new voicemail", lastPhone, "audio");
  // Ordinary pupils and a teacher exist only in the classroom memory, before the burnt figure appears.
  const memoryFigures = [];
  for (const {
    kind,
    position: [x, z],
    scale,
  } of CLASSROOM_MEMORY_CAST) {
    const person = createCharacter(kind);
    person.position.set(x, 0, z);
    person.scale.setScalar(scale);

    scene.add(person);
    memoryFigures.push(person);
    env.register(person, "memoryFigure", "classroom", {
      ruined: { visible: false },
      burned: { visible: false },
      normal: { visible: false },
      distorted: { visible: false },
      memory: { visible: true },
    });
  }
  const mara = createPerson(false);
  mara.position.set(0, 0, -70);
  mara.visible = false;
  scene.add(mara);
  target("mara", "Mara", mara, "story", {
    position: new THREE.Vector3(0, 1.3, -70),
  });
  const teacher = createPerson(true);
  teacher.position.set(0, 0, -34);
  teacher.visible = false;
  scene.add(teacher);
  const storage = addPickups({ scene, box, textPlane, interactables, env });
  const secrets = addSecrets({scene, box, textPlane, interactables, storage, env});
  const annex=addWestWing({scene,box,textPlane,floor,gate,interactables,builders:secrets.builders});
  const crtSecret=addCRTSecret({scene,box,textPlane,interactables,crt:crtTarget,builders:secrets.builders});
  const echoes=addSchoolEchoes({scene,box,textPlane,interactables,builders:secrets.builders,obstacles});
  const art = addSchoolArt({ scene, env, textPlane, box, interactables });
  const decay = addRoomDecay(scene, env);
  env.set("ruined", "school", true);
  return {
    scene,
    env,
    fusePanel,
    get powerFailure(){return powerFailure;},
    setPowerFailure(on){powerFailure=!!on;env.powerFailure=powerFailure;env.apply();annex.setPowerFailure(powerFailure);},
    art,
    decay,
    obstacles,
    interactables,
    lights,
    hideSpots,
    doors,
    front,
    latch,
    escapeDoor,
    mara,
    memoryFigures,
    storage,
    secrets,
    annex,
    secretExit:secrets.fireExit,
    crt:crtTarget,
    setCRT,
    crtSecret,
    echoes,
    teacher,
    rain,
    exterior,
    box,
    textPlane,
    ambientLockers,
    setAmbientLockerStates(opened){
      for(const l of ambientLockers){
        l.manualOpen=opened.has(l.target.id);l.manualAmount=l.manualOpen?1:0;
        l.hinge.rotation.y=l.direction*l.manualAmount*Math.PI*.56;
      }
    },
    resetAmbientLockers() {
      for (const l of ambientLockers) {
        l.playing = false;
        l.manualOpen=false;l.manualAmount=0;
        l.elapsed = 0;
        l.hinge.rotation.y = 0;
        l.collider.enabled = false;
      }
    },
    disturbLocker(position) {
      const candidates = ambientLockers.filter(
        (l) => !l.manualOpen&&Math.hypot(l.x - position.x, l.z - position.z) < 2,
      );
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x - position.x, a.z - position.z) -
          Math.hypot(b.x - position.x, b.z - position.z),
      );
      const l = candidates[0];
      if (l) {
        l.elapsed = 0;
        l.playing = true;
      }
    },
    releaseDoor(d, position) {
      this.onDoorHand?.(d,"release");
      releaseDoor(d, position);
    },
    pushDoors(position, dx, dz, radius, dt, player) {
      const moved=pushDoors([...doors,...secrets,secrets.fireExit],position,dx,dz,radius,dt,player);
      for(const d of moved){this.onDoorHand?.(d,"push");if(d.open)this.onDoorPushed?.(d);}
      return moved;
    },
    closeDoor(d, position, radius=.23) {
      if(segmentBlocked(position.x,position.z,doorShape({...d,angle:0}),radius)) return false;
      this.animateDoor(d,position,false);return true;
    },
    animateDoor(d, position, open=true) {
      this.onDoorHand?.(d,open?"open":"close");
      d.showKey=!!open && !d.unlatched && !!d.requires && d.requires!=='cutters';
      if (open) releaseDoor(d,position);
      d.motorTarget=open?1:0;d.motionTime=0;d.motionSound=false;
      if(open && d.lockVisual)d.lockVisual.visible=false;
    },
    openDoor(d, value = true) {
      // Scripted scenes and checkpoint hydration can still control their own doors.
      d.motorTarget=null;d.pushable=false;d.unlatched=value;d.creaked=false;d.amount=value?1:0;
      d.keyTurn.visible=false;for(const lever of d.handles)lever.rotation.z=0;
      d.open = value;
      d.obstacle.segment=null;
      d.obstacle.enabled = !value;
      if(!value){
        d.angle=0;d.hinge.rotation.y=d.rotation;
        const shape={minX:Math.min(d.hinge.position.x,d.hinge.position.x+d.baseAxis.x*d.width)-.15,
          maxX:Math.max(d.hinge.position.x,d.hinge.position.x+d.baseAxis.x*d.width)+.15,
          minZ:Math.min(d.hinge.position.z,d.hinge.position.z+d.baseAxis.z*d.width)-.15,
          maxZ:Math.max(d.hinge.position.z,d.hinge.position.z+d.baseAxis.z*d.width)+.15};
        Object.assign(d.obstacle,shape);
      }
    },
    update(dt, time, player) {
      animateStorage(storage, dt);
      legacyDrawer.drawerTray.position.z=THREE.MathUtils.lerp(legacyDrawer.drawerTray.position.z,legacyDrawer.open?.38:0,1-Math.exp(-dt*7));
      animateSecrets(secrets, dt);
      crtSecret.update(dt,time);
      fusePanel.update(dt,powerFailure,Boolean(this.powered));
      if(!this.exitTriggered && secrets.fireExit.unlatched && player?.position.x>30.45 && Math.abs(player.position.z+52.35)<1.1){
        this.exitTriggered=true;this.onSecretExit?.();
      }
      for (const actor of [mara, teacher, ...memoryFigures]){
        if(actor.userData.conversationHidden){actor.visible=false;continue;}
        animateCharacter(actor, dt, time);
      }
      for (const d of doors) {
        if (d.motorTarget != null) {
          d.motionTime += dt;
          const handle = -Math.sin(Math.min(1,d.motionTime/.5)*Math.PI)*.5;
          for(const lever of d.handles)lever.rotation.z=handle;
          d.keyTurn.visible=d.showKey && d.motionTime<.45;
          d.keyTurn.rotation.z=Math.min(1,d.motionTime/.35)*Math.PI/2;
          if(d.motionTime>.22){
            if(!d.motionSound){this.onDoorSound?.(d.motorTarget?'doorOpen':'doorClose',d);d.motionSound=true;}
            const direction=Math.sign(d.motorTarget-d.amount);
            d.amount=THREE.MathUtils.clamp(d.amount+direction*dt*.9,0,1);
            if(Math.abs(d.motorTarget-d.amount)<dt*.91){d.amount=d.motorTarget;d.motorTarget=null;d.keyTurn.visible=false;}
          }
          updatePushDoor(d);
          continue;
        }
        if(d.lockVisual)d.lockVisual.visible=!d.unlatched;
        if(d.pushable){updatePushDoor(d);continue;}
        const desired = d.open ? -Math.PI / 2 : 0;
        d.angle = THREE.MathUtils.lerp(d.angle, desired, 1 - Math.exp(-dt * 4));
        d.hinge.rotation.y = d.angle + d.rotation;
      }
      const friendly = ["normal", "memory"].includes(env.state);
      for (const l of ambientLockers) {
        const manual=l.manualOpen||l.manualAmount>.001;
        if (!l.playing&&!manual) continue;
        l.manualAmount=THREE.MathUtils.lerp(l.manualAmount,l.manualOpen?1:0,1-Math.exp(-dt*5));
        l.elapsed += dt;
        const amount =
          friendly || l.elapsed >= 2.1
            ? 0
            : Math.sin((Math.PI * l.elapsed) / 2.1) ** 2;
        l.hinge.rotation.y = l.direction * (manual?l.manualAmount*Math.PI*.56:amount*.32);
        l.face.updateWorldMatrix(true, false);
        const b = new THREE.Box3().setFromObject(l.face);
        Object.assign(l.collider, {
          minX: b.min.x,
          maxX: b.max.x,
          minZ: b.min.z,
          maxZ: b.max.z,
          enabled: manual?l.manualAmount>.005:amount>0.005,
        });
        l.face.getWorldPosition(l.target.position);
        if (!amount&&!manual) {
          l.playing = false;
          l.hinge.rotation.y = 0;
        }
      }
      exterior.color.setHex(friendly ? 0xffecc3 : 0x9fb9d9);
      exterior.intensity = friendly ? 2.1 : powerFailure?.14:0.8;
      for (const r of rain) {
        r.visible = !friendly;
        r.position.y -= dt * (0.5 + (r.position.z % 1) * 0.2);
        if (r.position.y < 1.4) r.position.y = 2.9;
      }
      for(const batch of this.rainBatches||[]){
        batch.mesh.visible=!friendly;
        if(friendly)continue;
        for(let i=0;i<batch.drops.length;i++){
          batch.drops[i].updateMatrix();batch.mesh.setMatrixAt(i,batch.drops[i].matrix);
        }
        batch.mesh.instanceMatrix.needsUpdate=true;
      }
      for (const f of lights) {
        const flicker =
          env.state === "ruined" ||
          env.state === "burned" ||
          env.state === "distorted"
            ? 0.9 + 0.1 * Math.sin(time * 19 + f.z) * Math.sin(time * 3.7 + f.z)
            : 1;
        const behind = powerFailure&&!friendly ? 0 :
          !friendly && player?.lightsOut && f.z > player.position.z + 3
            ? 0.08
            : 1;
        if (f.light) {
          f.light.intensity =
            f.base *
            flicker *
            behind *
            (friendly ? 1.7 : 1) *
            (1 + (this.scarePulse || 0) * 3);
          f.light.color.setHex(
            f.colorOverride ??
              (env.state === "memory" || env.state === "normal"
                ? 0xffd59e
                : env.state === "burned"
                  ? 0xcc7445
                  : 0xa6c4b8),
          );
        }
        if (f.tube)
          f.tube.material.emissiveIntensity =
            f.base * flicker * behind * (1 + (this.scarePulse || 0) * 3);
      }
    },
  };
}
export function createPerson(teacher = false) {
  return createCharacter(teacher ? "teacher" : "mara");
}
