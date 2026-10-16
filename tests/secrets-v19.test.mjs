import {pushThrough} from './helpers/push.mjs';
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
 g.inventory=new InventorySystem(g);g.interactions=new InteractionSystem(g);g.resources=new ResourceSystem(g);g.inventory.restore();
 g.target=id=>world.interactables.find(t=>t.id===id);
 g.step=()=>{world.update(1,1,g.player);g.inventory.syncStorage();};
 return g;
}
test('both secret rooms have real blocked entrances that become traversable after discovery and persist',async()=>{
 const g=game(),panel=g.target('secret_lostProperty');g.inventory.items.add('secretKey');
 const before=new T.Vector3(-13,1.65,-23.6);slide(before,-4,0,g.world.obstacles.filter(o=>o.minY<1.8&&o.maxY>.05));
 assert.ok(before.x > -15,'Closed west panel blocks entry');
 await g.interactions.use(panel);g.step();pushThrough(g,panel);
 const after=new T.Vector3(-13,1.65,-23.6);slide(after,-4,0,g.world.obstacles.filter(o=>o.minY<1.8&&o.maxY>.05));
 assert.ok(after.x < -16.9,'Open west panel exposes a real passage');
 assert.ok(new Navigation(g.world.obstacles).path({x:-13,z:-23.6},{x:-17,z:-23.6}).length, 'Navigation can pass below the lintel into the discovered room');
 const service=g.target('secret_serviceCache');
 await g.interactions.use(service);assert.equal(service.open,false,'Service panel needs its key');
 g.inventory.items.add('serviceKey');await g.interactions.use(service);g.step();pushThrough(g,service);
 const east=new T.Vector3(19,1.65,-52.5);slide(east,3,0,g.world.obstacles.filter(o=>o.minY<1.8&&o.maxY>.05));
 assert.ok(east.x>21.9,'Open east panel has a traversable passage');
 const save=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(save);
 assert.ok(g.world.secrets.filter(p=>['secret_lostProperty','secret_serviceCache'].includes(p.id)).every(p=>p.open&&p.obstacle.segment));
});
test('nested caches gate contents by both lids and key, with persistent tool and sanity rewards',async()=>{
 const g=game(),chest=g.target('cache_lostProperty'),key=g.target('secret_serviceKey');
 assert.equal(key.enabled,false);await g.interactions.use(chest);g.step();
 assert.equal(key.enabled,true);await g.interactions.use(key);assert.ok(g.inventory.has('serviceKey'));
 const crate=g.target('cache_serviceCrate'),toolbox=g.target('cache_toolbox'),cutters=g.target('secret_cutters');
 assert.equal(toolbox.enabled,false);assert.equal(cutters.enabled,false);
 await g.interactions.use(toolbox);assert.equal(toolbox.open,false);
 await g.interactions.use(crate);g.step();assert.equal(toolbox.enabled,true);assert.equal(cutters.enabled,false);
 g.inventory.items.delete('serviceKey');await g.interactions.use(toolbox);assert.equal(toolbox.open,false);
 g.inventory.items.add('serviceKey');await g.interactions.use(toolbox);g.step();assert.equal(cutters.enabled,true);
 await g.interactions.use(cutters);assert.ok(g.inventory.has('cutters'));
 await g.interactions.use(g.target('secret_calm_2'));assert.equal(g.inventory.groundingKits,1);
 assert.ok(g.inventory.useGroundingKit());assert.equal(g.player.sanity,75);assert.equal(g.inventory.groundingKits,0);
 const save=g.inventory.snapshot();g.inventory.restore(save);assert.equal(cutters.enabled,false);
 g.inventory.toggleStorage(crate);assert.equal(toolbox.enabled,false);assert.equal(g.target('secret_battery'),undefined);
});
test('grounding cards recover sanity only while nearby, lit and stationary, and kits clamp and persist',()=>{
 const g=game(),card=g.target('ground_reception');g.player.position.set(-4.4,1.65,8);
 assert.ok(g.resources.beginGrounding(card));g.resources.update(2);assert.equal(g.player.sanity,56);
 g.player.moving=true;g.resources.update(1);assert.equal(g.resources.restAt,null);assert.equal(g.player.sanity,56);
 g.player.moving=false;g.player.lightsOut=true;assert.equal(g.resources.beginGrounding(card),false);
 g.inventory.groundingKits=2;g.player.sanity=90;g.inventory.useGroundingKit();assert.equal(g.player.sanity,100);
 assert.equal(g.inventory.useGroundingKit(),false);assert.equal(g.inventory.groundingKits,1);
 const save=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(save);assert.equal(g.inventory.groundingKits,1);
});
test('zero stamina prevents sprinting until slow recovery reaches the exhaustion threshold',()=>{
 const world={scene:new T.Scene(),obstacles:[],flash:new T.SpotLight()};
 const p=new Player(new T.PerspectiveCamera(),world,{cue(){}},{...DEFAULTS});
 p.stamina=0;p.exhausted=true;p.keys.add('KeyW');p.keys.add('ShiftLeft');
 for(let i=0;i<60;i++)p.update(1/60);
 assert.equal(p.sprinting,false);assert.ok(p.stamina>0&&p.stamina<DEFAULTS.sprintCapacity*.4);
 p.keys.clear();for(let i=0;i<240;i++)p.update(1/60);
 assert.equal(p.exhausted,false);assert.ok(p.stamina<DEFAULTS.sprintCapacity,'Recovery is gradual, not instant');
 p.keys.add('KeyW');p.keys.add('ShiftLeft');p.update(1/60);assert.equal(p.sprinting,true);
});
