import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {loadMaraModel} from '../src/world/mara.js';
import {createSchool} from '../src/world/school.js';
import {batchStaticScenery,instanceRain} from '../src/world/optimize.js';
import {LightCulling} from '../src/systems/light-culling.js';
import {createEchoModel,animateEcho} from '../src/world/echo-models.js';
import {DEFAULTS} from '../src/data/config.js';
import {InventorySystem} from '../src/systems/inventory.js';
import {animateStorage} from '../src/world/pickups.js';
const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
globalThis.document={createElement:()=>({getContext:()=>ctx}),querySelector:()=>({style:{},classList:{add(){},remove(){}},textContent:''})};
const b=await readFile(new URL('../assets/models/mara-base.glb',import.meta.url));await loadMaraModel(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));

test('static batching reduces scenery submissions while preserving collision, interactions and all environmental states',()=>{
 const w=createSchool({},DEFAULTS);w.scene.updateMatrixWorld(true);
 const targets=w.interactables.map(t=>[t,t.mesh.parent,t.mesh.getWorldPosition(new T.Vector3())]);
 const obstacles=w.obstacles.map(o=>[o,o.minX,o.maxX,o.minZ,o.maxZ,o.enabled]);
 const stats=batchStaticScenery(w);
 assert.ok(stats.savedDraws>200,'Substantial scenery draw reduction');
 assert.ok(stats.meshesAfter<stats.meshesBefore*.5);
 for(const [t,parent,position] of targets){assert.equal(t.mesh.parent,parent,t.id+' retains its moving/interactive mesh');assert.ok(t.mesh.getWorldPosition(new T.Vector3()).equals(position));}
 for(const [o,minX,maxX,minZ,maxZ,enabled] of obstacles)assert.deepEqual([o.minX,o.maxX,o.minZ,o.maxZ,o.enabled],[minX,maxX,minZ,maxZ,enabled]);
 for(const state of ['normal','memory','burned','distorted','ruined']){
  w.env.set(state,'school',true);
  for(const entry of stats.batches){
   const match=w.env.entries.find(e=>e.mesh===entry.mesh);
   assert.equal(entry.mesh.material.color.getHex(),match.target.getHex());assert.equal(entry.mesh.visible,true);
  }
 }
 assert.equal(batchStaticScenery(w),stats,'No duplicate scenery on repeated setup');
 const gate=w.interactables.find(t=>t.door)?.door;
 w.openDoor(gate);assert.ok(gate.open);w.openDoor(gate,false);assert.equal(gate.open,false);
});

test('an empty or collected locker has no loose placeholder objects and settled doors do not recompute transforms',()=>{
 const w=createSchool({},DEFAULTS),g={world:w,config:{...DEFAULTS},player:{},story:{save(){},refreshObjective(){}},audio:{cue(){}},interactions:{notify(){}}};
 const inv=new InventorySystem(g);g.inventory=inv;inv.restore();
 for(const c of w.storage.filter(c=>c.kind==='locker')){
  const realItems=w.interactables.filter(t=>t.type==='pickup'&&t.container===c);
  assert.ok(c.tray.children.every(child=>realItems.some(t=>t.mesh===child)),'Only actual collectible models inside '+c.id);
 }
 const t=w.interactables.find(t=>t.id==='item_lockerKey'),c=t.container;
 c.open=true;animateStorage(w.storage,2);inv.syncStorage();inv.collect(t);assert.equal(t.mesh.visible,false);
 assert.ok(c.tray.children.every(m=>!m.visible),'Collected locker is genuinely empty');
 let updates=0;const original=c.root.updateMatrixWorld;
 c.root.updateMatrixWorld=function(...args){updates++;return original.apply(this,args);};
 for(let i=0;i<100;i++)animateStorage(w.storage,1/60);
 assert.equal(updates,0,'Settled storage does no repeated hierarchy updates');
 c.open=false;animateStorage(w.storage,1/60);assert.ok(updates>0,'Closing still animates');
});

test('finite offscreen and unpowered lamps skip rendering and restore authored visibility, including after camera turns',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(68,1,.06,90),culling=new LightCulling();
 const on=new T.PointLight(0xffffff,1,5),offscreen=new T.PointLight(0xffffff,1,2),edge=new T.PointLight(0xffffff,1,8),unpowered=new T.PointLight(0xffffff,0,5),hidden=new T.PointLight(0xffffff,1,5);
 on.position.set(0,1,-5);offscreen.position.set(30,1,5);edge.position.set(7,1,-5);unpowered.position.copy(on.position);hidden.visible=false;
 scene.add(on,offscreen,edge,unpowered,hidden);camera.position.y=1;
 culling.begin({scene},camera);assert.ok(on.visible&&edge.visible,'A lamp outside the view stays active when its light reaches the view');assert.equal(offscreen.visible,false);assert.equal(unpowered.visible,false);culling.end();
 assert.ok(offscreen.visible&&unpowered.visible);assert.equal(hidden.visible,false);
 camera.lookAt(offscreen.position);culling.begin(culling.world,camera);assert.ok(offscreen.visible,'Turning the camera restores the light');culling.end();
});

test('all five articulated flame pairs use two instanced drawables and retain their separate motion',()=>{
 const s=createEchoModel('student',1);s.visible=true;
 const {flames,flameInstances}=s.userData;assert.equal(flames.length,5);
 assert.equal(flameInstances.outer.count,5);assert.equal(flameInstances.inner.count,5);
 assert.ok(flames.every(f=>f.parent===null));
 const before=flameInstances.outer.instanceMatrix.array.slice();animateEcho(s,.1,2);
 assert.notDeepEqual(flameInstances.outer.instanceMatrix.array,before);
 assert.ok(flames[0].rotation.z!==flames[1].rotation.z);
});


test('window rain uses one instanced mesh per window, keeps falling, and disappears in friendly memories',()=>{
 const w=createSchool({},DEFAULTS),batches=instanceRain(w);
 assert.equal(batches.length,w.rain.length/18);
 const b=batches[0],before=b.mesh.instanceMatrix.array.slice();
 assert.ok(b.drops.every(d=>d.parent===null));
 w.update(.1,1,{position:new T.Vector3()});
 assert.notDeepEqual(b.mesh.instanceMatrix.array,before);
 w.env.set('memory','school',true);w.update(.1,2,{position:new T.Vector3()});
 assert.ok(batches.every(b=>!b.mesh.visible));
 w.env.set('ruined','school',true);w.update(.1,3,{position:new T.Vector3()});
 assert.ok(batches.every(b=>b.mesh.visible));
});
