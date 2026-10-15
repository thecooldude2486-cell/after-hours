import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {createSchool} from '../src/world/school.js';
import {loadMaraModel} from '../src/world/mara.js';
import {loadHandModels} from '../src/world/hand-rig.js';
import {DEFAULTS} from '../src/data/config.js';
import {InventorySystem} from '../src/systems/inventory.js';
import {InteractionSystem} from '../src/systems/interaction.js';
import {ResourceSystem} from '../src/systems/resources.js';
import {Player} from '../src/systems/player.js';
import {slide, Navigation} from '../src/systems/navigation.js';
const element=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){},textContent:''});
const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
globalThis.document={createElement:()=>({getContext:()=>ctx}),querySelector:()=>element(),addEventListener(){}};
globalThis.window={addEventListener(){}};
const buffer=await readFile(new URL('../assets/models/mara-base.glb',import.meta.url));
await loadMaraModel(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
const bytes={};
for(const side of ['left','right']){const b=await readFile(new URL('../assets/models/hand-'+side+'-v14.glb',import.meta.url));bytes[side]=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
await loadHandModels(bytes);
function game(){
 const world=createSchool({},DEFAULTS);
 const g={world,config:{...DEFAULTS},time:0,audio:{cue(){}},teacher:{active:false},cinematics:{},ambushes:{},
  player:{position:new T.Vector3(),keys:new Set(),battery:100,sanity:50,flashlight:true,moving:false,stamina:4.5,syncFlashlight(){}},
  story:{save(){},refreshObjective(){},label:t=>t.label},cheats:{}};
 g.camera=new T.PerspectiveCamera(68,1.6,.06,90);g.requestLock=()=>{};g.finish=ending=>g.finished=ending;
 g.inventory=new InventorySystem(g);g.interactions=new InteractionSystem(g);g.resources=new ResourceSystem(g);g.inventory.restore();
 g.target=id=>world.interactables.find(t=>t.id===id);
 g.step=()=>{world.update(1,1,g.player);g.inventory.syncStorage();world.scene.updateMatrixWorld(true);};
 return g;
}


test('locker contents appear during opening, stay uncollectable until accessible, and hang in the visible cavity',async()=>{
 const g=game(),key=g.target('item_lockerKey'),c=key.container;
 assert.equal(c.kind,'locker');assert.equal(key.mesh.visible,false);
 assert.ok(key.mesh.position.y>.4,'Key hangs above the shelf');
 assert.ok(key.mesh.position.z>-.24&&key.mesh.position.z<.2,'Key is inside the cabinet');
 await g.interactions.use(c);
 g.world.update(.04,0,g.player);g.inventory.syncStorage();
 assert.ok(c.amount>.08&&c.amount<.85);assert.equal(key.mesh.visible,true);assert.equal(key.enabled,false);
 await g.interactions.use(key);assert.equal(g.inventory.has('lockerKey'),false);
 g.step();assert.equal(key.enabled,true);
 const front=c.approach.clone();front.y=1.65;
 const ray=new T.Raycaster(front,key.position.clone().sub(front).normalize(),0,front.distanceTo(key.position));
 c.root.updateMatrixWorld(true);
 const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
 const hits=ray.intersectObject(g.world.scene,true).filter(h=>visible(h.object)&&!key.mesh.getObjectById(h.object.id)&&h.distance<front.distanceTo(key.position)-.03);
 assert.equal(hits.length,0,'No cabinet panel obscures the hanging key from its normal approach');
 await g.interactions.use(key);assert.equal(key.mesh.visible,false);
 const save=g.inventory.snapshot();g.inventory.restore(save);assert.equal(key.mesh.visible,false);
});

test('all locker cavities have an actual interior and corridor books are inside hollow collision bodies',()=>{
 const g=game();
 const cabinets=g.world.storage.filter(c=>c.kind==='locker');
 for(const c of cabinets){assert.ok(c.root.getObjectByName('Pale locker interior'));assert.ok(c.root.getObjectByName('Locker shelf liner'));}
 for(const state of ['normal','burned','distorted','ruined']) {
  g.world.env.set(state,'school',true);
  for(const o of g.world.obstacles)if(o.mesh?.userData.collisionOnly)assert.equal(o.mesh.visible,false,'Collision-only geometry stays hidden in '+state);
 }
 const books=g.world.scene.getObjectsByProperty('name','Forgotten locker notebook');
 assert.ok(books.length>10);
 for(const b of books) {
  const bodies=g.world.obstacles.filter(o=>o.minY===0&&o.maxY===2.54&&Math.abs(o.mesh?.position.z-b.position.z)<.3);
  assert.ok(bodies.some(o=>!o.mesh.visible),'Opaque collision body is hidden around an interior notebook');
 }
});
