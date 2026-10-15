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
 g.camera=new T.PerspectiveCamera(68,1.6,.06,90);g.requestLock=()=>{};g.finish=ending=>g.finished=ending;
 g.inventory=new InventorySystem(g);g.interactions=new InteractionSystem(g);g.resources=new ResourceSystem(g);g.inventory.restore();
 g.target=id=>world.interactables.find(t=>t.id===id);
 g.step=()=>{world.update(1,1,g.player);g.inventory.syncStorage();world.scene.updateMatrixWorld(true);};
 return g;
}


import {PlayerPhysics} from '../src/systems/physics.js';
import {blocked} from '../src/systems/navigation.js';
function walkTo(g,x,z){
 const nav=new Navigation(g.world.obstacles),route=nav.path(g.player.position,{x,z});
 assert.ok(route.length||Math.hypot(g.player.position.x-x,g.player.position.z-z)<.3,'Reachable '+x+','+z);
 const p=g.player;p.world=g.world;p.config=g.config;p.audio=g.audio;const body=new PlayerPhysics(p);
 for(const at of route){let frames=0;while(Math.hypot(at.x-p.position.x,at.z-p.position.z)>.085&&frames++<160){
  const dx=at.x-p.position.x,dz=at.z-p.position.z,d=Math.hypot(dx,dz);body.update(1/60,dx/d*2.35/60,dz/d*2.35/60,false);
 }assert.ok(frames<160,'Physical route clear at '+JSON.stringify(at));}
 g.step();
}
function push(g,door){
 const centre={x:door.hinge.position.x+door.baseAxis.x*door.width/2,z:door.hinge.position.z+door.baseAxis.z*door.width/2};
 const side=Math.sign(g.player.position.x-centre.x)||1,p=g.player;
 p.world=g.world;p.config=g.config;p.audio=g.audio;const body=new PlayerPhysics(p);
 for(let i=0;i<150;i++){body.update(1/60,-side*2.35/60,0,false);if((p.position.x-centre.x)*side<-.9)break;}
 g.step();assert.ok((p.position.x-centre.x)*side<-.5,'Pushed '+door.id);
}
async function act(g,id){await g.interactions.use(g.target(id));g.step();if(g.interactions.reader)g.interactions.close();}

test('west wing is a substantial connected expansion; its keys and tools form a physically playable route',async()=>{
 const g=game();g.player.position.set(0,1.65,-50);
 assert.equal(g.world.annex.rooms.length,4);assert.ok(g.world.annex.area>600);
 walkTo(g,-29,-39);await act(g,'annex_library');push(g,g.target('annex_library').door);
 walkTo(g,-39,-37.6);await act(g,'annex_hollowBook');await act(g,'annex_clinicKey');assert.ok(g.inventory.has('clinicKey'));
 walkTo(g,-34,-39.25);await act(g,'annex_libraryDrawer');await act(g,'annex_workshopKey');
 // Return through the opened library door, then unlock the infirmary.
 walkTo(g,-29,-55);await act(g,'annex_infirmary');push(g,g.target('annex_infirmary').door);
 walkTo(g,-34,-56.4);await act(g,'annex_medicineCase');await act(g,'annex_secretKey');assert.ok(g.inventory.has('secretKey'));
 walkTo(g,-29,-56);await act(g,'annex_workshop');push(g,g.target('annex_workshop').door);
 walkTo(g,-24,-58.2);await act(g,'annex_toolChest');await act(g,'annex_valveWheel');await act(g,'annex_pliers');
 walkTo(g,-29,-40);await act(g,'annex_boiler');push(g,g.target('annex_boiler').door);
 assert.equal(new Navigation(g.world.obstacles).path(g.player.position,{x:-22,z:-39.5}).length,0,'Live steam blocks the far-side supply case');
 walkTo(g,-26,-41.9);await act(g,'annex_steamValve');assert.equal(g.world.annex.steamCollider.enabled,false);assert.equal(g.inventory.has('valveWheel'),false);
 walkTo(g,-22,-40.3);await act(g,'annex_fuseCase');await act(g,'annex_spareFuse');assert.ok(g.inventory.has('fuse'));
 const save=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(save);
 assert.ok(g.inventory.has('secretKey'));assert.equal(g.world.annex.steamCollider.enabled,false);assert.ok(g.world.annex.wheel.visible);
 assert.equal(g.target('annex_spareFuse').enabled,false);
});

test('every secret-room entrance needs the iron key, while keeping its tool or code lock',async()=>{
 const g=game();for(const id of ['serviceKey','screwdriver','crowbar'])g.inventory.items.add(id);g.inventory.power=true;
 for(const t of g.world.secrets){await g.interactions.use(t);assert.equal(t.unlatched,false,t.id+' needs the iron key');assert.equal(g.interactions.reader,false);}
 g.inventory.items.add('secretKey');await g.interactions.use(g.target('secret_lostProperty'));assert.ok(g.target('secret_lostProperty').unlatched);
 g.inventory.items.delete('screwdriver');await g.interactions.use(g.target('secret_mapStore'));assert.equal(g.target('secret_mapStore').unlatched,false,'Map-store cover still needs its screwdriver');
 await g.interactions.use(g.target('secret_vault'));assert.ok(g.interactions.reader);assert.equal(g.interactions.submitCode('123'),false);assert.equal(g.interactions.submitCode('417'),true);
});

test('classroom blood writing swaps correctly with clean memories, and doors are human sized with matching solid frames',()=>{
 const g=game();
 for(const room of ['classroom','phone']){
  const ink=g.world.env.entries.find(e=>e.role==='wall-writing'&&e.room===room);
  const chalk=g.world.env.entries.find(e=>e.role==='classroom-chalk'&&e.room===room);
  assert.ok(ink&&ink.mesh.material.map);assert.equal(ink.mesh.visible,true);assert.equal(chalk.mesh.visible,false);
  g.world.env.set('memory',room,true);assert.equal(ink.mesh.visible,false);assert.equal(chalk.mesh.visible,true);
  g.world.env.set('burned',room,true);assert.equal(ink.mesh.visible,true);assert.equal(chalk.mesh.visible,false);
 }
 for(const id of ['classroomGate','phoneGate']){
  const d=g.target(id).door;assert.equal(d.width,1.05);assert.equal(d.height,2.1);
  assert.equal(d.leaf.geometry.parameters.height,2.1);
  assert.ok(blocked(d.hinge.position.x,d.hinge.position.z+.25,g.world.obstacles.filter(o=>o!==d.obstacle),.05),'Door frame closes the old oversized opening');
 }
});
