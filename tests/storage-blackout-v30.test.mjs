import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {loadMaraModel} from '../src/world/mara.js';
import {loadHandModels} from '../src/world/hand-rig.js';
import {createSchool} from '../src/world/school.js';
import {DEFAULTS} from '../src/data/config.js';
import {BEATS} from '../src/data/beats.js';
import {InventorySystem} from '../src/systems/inventory.js';
import {InteractionSystem} from '../src/systems/interaction.js';
import {FlashlightSystem} from '../src/systems/flashlight.js';
const ctx=new Proxy({},{get:()=>()=>{},set:()=>true}),elements=new Map();
globalThis.document={createElement:()=>({getContext:()=>ctx}),addEventListener(){},querySelector(s){
  if(!elements.has(s)){const classes=new Set();elements.set(s,{style:{},textContent:'',classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)}});}
  return elements.get(s);
}};
globalThis.window={addEventListener(){}};
const buffer=async path=>{const b=await readFile(new URL('../'+path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
await loadMaraModel(await buffer('assets/models/mara-base.glb'));
await loadHandModels({left:await buffer('assets/models/hand-left-v14.glb'),right:await buffer('assets/models/hand-right-v14.glb')});
function game(){
  const g={config:{...DEFAULTS},world:createSchool({},DEFAULTS),teacher:{active:false},cinematics:{},ambushes:{},cheats:{},
    player:{position:new T.Vector3(0,1.65,-5.5),keys:new Set(),sanity:100,stamina:5.5,bob:0},
    audio:{cue(){}},story:{stage:'fault',save(){},refreshObjective(){},signal(){},label:t=>t.label},requestLock(){}};
  g.camera=new T.PerspectiveCamera(68,1.6,.06,90);g.camera.position.copy(g.player.position);
  g.inventory=new InventorySystem(g);g.interactions=new InteractionSystem(g);g.flashlight=new FlashlightSystem(g);g.inventory.restore();
  g.target=id=>g.world.interactables.find(t=>t.id===id);
  g.step=()=>{g.world.update(1,1,g.player);g.inventory.syncStorage();g.world.scene.updateMatrixWorld(true);};return g;
}
function clearView(g,target,from){
  g.world.scene.updateMatrixWorld(true);const distance=from.distanceTo(target.position);
  const ray=new T.Raycaster(from,target.position.clone().sub(from).normalize(),0,distance-.03);
  const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
  return ray.intersectObject(g.world.scene,true).filter(h=>visible(h.object)&&!target.mesh.getObjectById(h.object.id));
}
test('open loot drawers and lockers expose every required item from their normal approach',()=>{
  const g=game();
  for(const preset of ['story','easy','normal','hard','nightmare']){
    g.config.preset=preset;g.inventory.restore({});
    for(const item of ['lockerKey','classroomKey','staffKey','recordsKey','fuse','cutters']){
      const t=g.target('item_'+item),c=t.container;c.open=true;g.inventory.opened.add(c.id);g.step();
      assert.ok(t.enabled,item+' is collectible in '+preset);
      const from=c.approach.clone();from.y=1.65;
      const occluders=clearView(g,t,from);
      assert.equal(occluders.length,0,preset+' '+item+' is not covered: '+JSON.stringify(occluders.map(h=>({name:h.object.name,point:h.point.toArray(),position:h.object.getWorldPosition(new T.Vector3()).toArray(),geometry:h.object.geometry.parameters}))));
      if(c.kind==='locker'){
        assert.ok(c.root.getObjectByName('Pale locker interior'));
        assert.ok(c.root.getObjectByName('Coat hook'));
      }
    }
  }
});
test('ordinary corridor lockers open, reveal real interiors and preserve their open state',async()=>{
  const g=game(),l=g.world.ambientLockers.find(l=>l.x<0),t=l.target;
  await g.interactions.use(t);g.step();
  assert.ok(l.manualOpen);assert.ok(Math.abs(l.hinge.rotation.y)>1.5);
  const book=g.world.scene.getObjectsByProperty('name','Forgotten locker notebook').find(m=>Math.abs(m.position.z-l.z)<.3&&Math.abs(m.position.x-l.x)<.2);
  assert.ok(book);
  const from=new T.Vector3(l.x+1.5,1.65,l.z+.16),point=book.position.clone();
  assert.equal(clearView(g,{mesh:book,position:point},from).length,0,'Shelf contents are visible through the open door');
  const save=g.inventory.snapshot();g.world.resetAmbientLockers();g.inventory.restore(save);g.step();
  assert.ok(l.manualOpen&&g.inventory.opened.has(t.id));
});
test('the blackout keeps the same position and can only be repaired after finding the light and fuse',()=>{
  const g=game(),position=g.player.position.clone(),before=g.world.env.ambient.intensity;
  assert.ok(!BEATS.find(b=>b.id==='walkedAway').effects.some(e=>e.type==='teleport'));
  assert.ok(!BEATS.find(b=>b.id==='afternoon').effects.some(e=>e.type==='teleport'));
  g.inventory.failPower();g.step();
  assert.ok(g.player.position.equals(position));assert.ok(g.inventory.powerFailure);
  assert.ok(g.world.env.ambient.intensity<before*.2);
  assert.ok(g.world.lights.filter(f=>f.light).every(f=>f.light.intensity===0));
  g.inventory.items.add('fuse');assert.equal(g.inventory.repairPower(),false);
  assert.ok(g.inventory.has('fuse'),'A failed dark inspection does not consume the fuse');
  g.inventory.items.add('flashlight');g.inventory.flashlightOn=true;
  assert.equal(g.inventory.repairPower(),true);g.step();
  assert.equal(g.inventory.powerFailure,false);assert.ok(g.world.powered);
  assert.ok(g.world.env.ambient.intensity>before*.9);assert.ok(g.player.position.equals(position));
  assert.ok(g.world.fusePanel.lever.rotation.z>.5);assert.ok(g.world.fusePanel.fuses[1].visible);
});
test('the emergency flashlight is physically found, held with a real beam, toggled and saved without batteries',async()=>{
  const g=game(),t=g.target('item_flashlight');g.inventory.failPower();
  g.flashlight.update(0,0);assert.equal(g.flashlight.view,null);assert.equal(t.enabled,false);
  await g.interactions.use(t.container);g.step();
  assert.ok(t.enabled);const from=t.container.approach.clone();from.y=1.65;assert.equal(clearView(g,t,from).length,0);
  await g.interactions.use(t);g.flashlight.update(.1,1);
  assert.ok(g.inventory.has('flashlight'));assert.ok(g.flashlight.view.root.visible);assert.ok(g.flashlight.beam.intensity>0);
  assert.ok(Number.isFinite(g.flashlight.beam.position.x));
  g.flashlight.toggle();g.flashlight.update(.1,2);assert.equal(g.flashlight.beam.intensity,0);
  const save=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(save);g.flashlight.update(.1,3);
  assert.equal(g.inventory.flashlightOn,false);assert.equal(g.flashlight.beam.intensity,0);assert.ok(g.inventory.powerFailure);
  assert.equal(Object.hasOwn(save,'batteries'),false);
});
test('an earlier power repair cannot consume the only replacement fuse for the later blackout',()=>{
  const g=game();g.inventory.items.add('fuse');g.inventory.collected.add('item_fuse');
  g.inventory.repairPower();assert.equal(g.inventory.has('fuse'),false);
  g.inventory.failPower();assert.ok(g.target('item_fuse').available);
  assert.equal(g.inventory.collected.has('item_fuse'),false);
});
