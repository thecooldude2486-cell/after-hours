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

const activeObstacles=g=>g.world.obstacles.filter(o=>o.enabled!==false&&o.minY<1.8&&o.maxY>.05);
function focus(g,id) {
 const target=g.target(id);g.step();
 for(const radius of [1,1.5,.65]) for(let i=0;i<16;i++) {
  const a=i*Math.PI/8,x=target.position.x+Math.cos(a)*radius,z=target.position.z+Math.sin(a)*radius;
  if(target.type==='secretExit'&&x>29.7)continue;
  if(activeObstacles(g).some(o=>x+.24>o.minX&&x-.24<o.maxX&&z+.24>o.minZ&&z-.24<o.maxZ))continue;
  g.player.position.set(x,1.65,z);g.camera.position.copy(g.player.position);g.camera.lookAt(target.position);g.camera.updateMatrixWorld(true);
  g.interactions.update();if(g.interactions.focus===target)return true;
 }
 return false;
}
async function use(g,id) {
 assert.ok(focus(g,id),id+' can be selected from a free standing position');
 await g.interactions.use();g.step();
 if(g.target(id).type==='secretDoor' && g.target(id).unlatched && !g.interactions.reader)pushThrough(g,g.target(id));
}
async function read(g,id){await use(g,id);assert.ok(g.interactions.reader);g.interactions.close();}

test('all five rooms block the body until opened and expose real navigable passages',async()=>{
 const g=game();g.inventory.items.add('secretKey');
 for(const [id,x,z,dx] of [['secret_lostProperty',-13,-23.6,-4],['secret_serviceCache',19,-52.5,3],
   ['secret_mapStore',13,-22,4],['secret_projection',-13,-40,-4],['secret_vault',24,-52.5,3]]) {
  const p=new T.Vector3(x,1.65,z);slide(p,dx,0,activeObstacles(g));assert.ok(dx<0 ? p.x>g.target(id).position.x : p.x<g.target(id).position.x,id+' is closed');
  const t=g.target(id);if(t.requires)g.inventory.items.add(t.requires);
  if(t.code){g.inventory.power=true;await g.interactions.use(t);assert.ok(g.interactions.submitCode('417'));}
  else await g.interactions.use(t);
  g.step();pushThrough(g,t);
  const after=new T.Vector3(x,1.65,z);slide(after,dx,0,activeObstacles(g));
  assert.ok(Math.abs(after.x-(x+dx))<.15,id+' has a traversable opening');
  assert.ok(new Navigation(g.world.obstacles).path({x,z},{x:x+dx,z}).length,id+' is navigable');
 }
 const save=g.inventory.snapshot();g.inventory.restore(save);
 assert.ok(g.world.secrets.every(p=>p.open&&p.obstacle.segment));
});

test('full connected route uses reachable items, every lock, projected code, chain and alternate escape',async()=>{
 const g=game();g.inventory.items.add('secretKey');
 await read(g,'clue_reception');
 await use(g,'secret_lostProperty');await use(g,'cache_lostProperty');await use(g,'secret_serviceKey');
 await read(g,'clue_lost');
 await use(g,'secret_serviceCache');await use(g,'cache_serviceCrate');
 await use(g,'secret_crowbar');await use(g,'cache_toolbox');
 for(const id of ['secret_screwdriver','secret_cutters'])await use(g,id);
 await read(g,'clue_tools');
 await use(g,'secret_mapStore');await use(g,'cache_mapCabinet');await use(g,'secret_crank');
 await read(g,'clue_maps');
 await use(g,'secret_projection');await read(g,'clue_booth');
 await use(g,'puzzle_projector');assert.equal(g.interactions.reader,false,'No projection without power');
 assert.equal(g.inventory.notes.has('clue_slide'),false);
 g.inventory.items.add('fuse');assert.ok(g.inventory.repairPower());
 await use(g,'puzzle_projector');assert.ok(g.inventory.notes.has('clue_slide'));g.interactions.close();
 assert.ok(g.target('puzzle_projector').projected.visible);
 await use(g,'secret_vault');assert.equal(g.interactions.submitCode('123'),false);assert.equal(g.target('secret_vault').open,false);
 for(const digit of ['4','1','7','enter'])g.interactions.pressDigit(digit);
 assert.equal(g.interactions.reader,false);g.step();pushThrough(g,g.target('secret_vault'));assert.equal(g.target('secret_vault').open,true);
 await use(g,'cache_rescueCase');await use(g,'secret_rescueKey');
 await use(g,'secret_fireExit');assert.equal(g.finished,undefined,'Read the actual evidence before escaping');
 await read(g,'clue_truth');
 const save=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(save);
 assert.ok(g.inventory.notes.has('clue_slide'));assert.ok(g.inventory.notes.has('clue_truth'));
 assert.ok(g.target('puzzle_projector').projected.visible);assert.equal(g.target('secret_rescueKey').enabled,false);
 g.interactions.openJournal();assert.ok(document.querySelector('#readBody').textContent!==null);g.interactions.close();
 await use(g,'secret_fireExit');assert.equal(g.finished,undefined,'Unlocking alone does not escape');pushThrough(g,g.target('secret_fireExit'));assert.equal(g.finished,'secret');
});

test('tools gate each new lock and old saves have a clean journal',async()=>{
 const g=game();
 for(const id of ['secret_mapStore','secret_projection']) {await g.interactions.use(g.target(id));assert.equal(g.target(id).open,false);}
 await g.interactions.use(g.target('cache_rescueCase'));assert.equal(g.target('cache_rescueCase').open,false);
 await g.interactions.use(g.target('puzzle_projector'));assert.equal(g.inventory.notes.has('clue_slide'),false);
 g.inventory.restore({items:['serviceKey'],opened:['secret_lostProperty']});
 assert.equal(g.inventory.notes.size,0);assert.equal(g.target('secret_mapStore').open,false);
 assert.equal(g.target('puzzle_projector').projected.visible,false);
});

test('school-power repair never grants the sanity bonus repeatedly',()=>{
 const g=game();g.inventory.items.add('fuse');assert.ok(g.inventory.repairPower());
 g.player.sanity=22;assert.ok(g.inventory.repairPower());
assert.equal(g.player.sanity,22);
});
