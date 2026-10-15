import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import { DistantFigure } from '../src/world/distant-figure.js';
import { HAUNTINGS } from '../src/data/hauntings.js';
import { createRoomMonster, animateRoomMonster } from '../src/world/room-monster.js';
import { SFX } from '../src/data/sfx.js';
import { loadHandModels } from '../src/world/hand-rig.js';
import { createFlashlightViewModel } from '../src/world/viewmodel.js';

globalThis.document = { createElement: () => ({getContext: () => new Proxy({}, {get: () => () => {}})}) };

test('each apparition exposes only part of its head and its actual sight point survives the clipping planes', () => {
  const f = new DistantFigure(new T.Scene());
  for (const e of HAUNTINGS.filter(e => e.type === 'apparition')) {
    f.setPeek(e);
    f.mesh.updateMatrixWorld(true);
    const point = f.sightPoint(e);
    for (const plane of f.clipPlanes) assert.ok(plane.distanceToPoint(point) >= 0, e.id);
    const local = f.mesh.worldToLocal(point.clone());
    assert.ok(((local.x/.12)**2 + ((local.y-1.76)/.15)**2) < 1, e.id + ' sight point on visible head');
    let visible = 0;
    const p = f.head.geometry.attributes.position;
    for (let i=0; i<p.count; i++) {
      const v = f.head.localToWorld(new T.Vector3().fromBufferAttribute(p,i));
      if (f.clipPlanes.every(plane => plane.distanceToPoint(v)>=0)) visible++;
    }
    assert.ok(visible/p.count > .15 && visible/p.count < .5, e.id + ' only a partial face is exposed');
    assert.ok(f.clipPlanes.some(plane => plane.distanceToPoint(f.mesh.localToWorld(new T.Vector3(0, .8, 0))) < 0), 'Lower body remains hidden');
  }
});

test('room monsters have different animated poses and different bundled positional voices', async () => {
  const poses=[];
  for (const variant of ['office','phone','archive']) {
    const actor=createRoomMonster(variant);
    actor.userData.scareAmount=1;
    animateRoomMonster(actor,.016,.7);
    poses.push(["Head","Chest","UpperArmL","UpperArmR"].map(n => actor.userData.bones[n].quaternion.clone()));
    const cue=SFX[variant+'Monster'];
    assert.equal(cue.bus,'scares');
    const wav=await readFile(new URL('../'+cue.files[0],import.meta.url));
    assert.equal(wav.toString('ascii',0,4),'RIFF');
    assert.equal(wav.readUInt16LE(22),1,'mono source for positional playback');
    assert.ok(wav.length>200000);
  }
  for(let i=0;i<poses.length;i++) for(let j=i+1;j<poses.length;j++) assert.ok(poses[i].reduce((sum,q,k)=>sum+q.angleTo(poses[j][k]),0)>.3);
});

test('flashlight points along the view and hand remains rigidly attached to its barrel', async () => {
  const bytes={};
  for(const side of ['left','right']) {
    const b=await readFile(new URL('../assets/models/hand-'+side+'-v14.glb',import.meta.url));
    bytes[side]=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  }
  await loadHandModels(bytes);
  const camera=new T.PerspectiveCamera(68,1.6,.06,90), view=createFlashlightViewModel(camera,new T.Scene());
  view.root.updateWorldMatrix(true,true);
  const direction=new T.Vector3(-1,0,0).applyQuaternion(view.torch.getWorldQuaternion(new T.Quaternion()));
  assert.ok(direction.dot(camera.getWorldDirection(new T.Vector3()))>.98,'neutral forward aim');
  assert.equal(view.torch.parent,view.hands[0].root);
  assert.ok(view.hands.every(hand => hand.root.visible), "Both hands are visible in the first-person pose");
  assert.ok(view.muzzle().z<view.hands[0].root.position.z);
  const player = { moving: false, physics: {}, flashlight: true, battery: 100, lightFactor: 1 };
  view.update(player, 0);
  const lit = view.fill.intensity;
  player.flashlight = false;
  view.update(player, 0);
  assert.ok(view.fill.intensity < lit / 20, "Hand fill does not act as a torch when switched off");
});

test('apparitions have a sculpted face, coat and hands, plus distinct arrival and retreat sound assets', async () => {
  const figure = new DistantFigure(new T.Scene());
  figure.setPeek({at:[0,-10]});
  assert.equal(figure.mesh.getObjectsByProperty('name','Recessed eye socket').length,2);
  assert.equal(figure.mesh.getObjectsByProperty('name','Hanging finger').length,8);
  assert.ok(figure.mesh.getObjectByName('Hollow mouth'));
  assert.notEqual(figure.head.material,figure.torso.material);
  assert.ok(figure.torso.scale.x*figure.torso.geometry.parameters.points[3].x > .2);
  for (const material of figure.materials) assert.equal(material.clippingPlanes,figure.clipPlanes);
  const paths = ['apparitionArrival','apparitionVanish'].map(name=>SFX[name].files[0]);
  assert.notEqual(paths[0],paths[1]);
  for (const path of paths) {
    const wav=await readFile(new URL('../'+path,import.meta.url));
    assert.equal(wav.toString('ascii',0,4),'RIFF');
    assert.equal(wav.readUInt16LE(22),1);
    let peak=0;
    for(let i=44;i<wav.length;i+=2) peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));
    assert.ok(peak>20000 && peak<30000);
  }
});
