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


import { PlayerPhysics } from '../src/systems/physics.js';
import { blocked } from '../src/systems/navigation.js';
function drive(g,start,dx,dz,frames=150){
 const p=g.player;p.world=g.world;p.audio=g.audio;p.config=g.config;p.position.set(...start);
 const physics=new PlayerPhysics(p);
 for(let i=0;i<frames;i++){physics.update(1/60,dx/60,dz/60,false);g.world.update(1/60,i/60,p);}
 return p.position.clone();
}
test('a matching classroom key animates the lock, handle and leaf, then permits passage from either side',async()=>{
 for(const side of [-1,1]){
 const g=game(),t=g.target('classroomGate'),d=t.door,cues=[];g.audio.cue=name=>cues.push(name);
 const start=[-3+side*1.4,1.65,-16.5];g.player.position.set(...start);
 await g.interactions.use(t);assert.equal(!!d.unlatched,false);assert.ok(cues.includes('locked'));
 g.inventory.items.add('classroomKey');await g.interactions.use(t);
 assert.equal(d.motorTarget,1);g.world.update(.12,.12,g.player);
 assert.ok(d.handles.some(h=>Math.abs(h.rotation.z)>.1));assert.ok(d.keyTurn.visible);assert.equal(d.lockVisual.visible,false);
 const initial=d.amount;g.world.update(.2,.32,g.player);assert.ok(d.amount>initial&&d.amount<1,'Actual intermediate opening');
 for(let i=0;i<90;i++)g.world.update(1/60,i/60,g.player);
 assert.equal(d.amount,1);assert.ok(d.open);assert.ok(cues.includes('unlock'));assert.ok(cues.includes('doorOpen'));
 const end=drive(g,start,-side*2.35,0);
 assert.ok(side===1?end.x<-3.5:end.x>-2.5,'Player crosses animated opening');
 assert.ok(g.inventory.opened.has(d.id));
 }
});
test('locked doors block movement and walking parallel to an ajar leaf does not push it',async()=>{
 const g=game(),t=g.target('classroomGate'),d=t.door;
 const end=drive(g,[-1.6,1.65,-16.5],-2.35,0,90);
 assert.ok(end.x>-3);assert.equal(d.open,false);
 g.inventory.items.add('classroomKey');await g.interactions.use(t);
 const a=d.amount;g.world.pushDoors({x:0,z:-10},0,-.1,.23);assert.equal(d.amount,a);
});
test('CRT defaults off and restores its exact switch, screen and spill state after a refresh',async()=>{
 const g=game(),crt=g.target('crt'),lightSwitch=g.target('switch');
 assert.equal(crt.open,false);assert.equal(crt.spill.intensity,0);assert.equal(crt.glow.intensity,0);
 assert.equal(crt.screen.material.emissiveIntensity,0);
 const before=g.player.lightsOut;
 await g.interactions.use(crt);assert.ok(crt.open);assert.equal(crt.spill.intensity,.14);assert.equal(crt.glow.intensity,.62);
 assert.equal(g.player.lightsOut,before);
 const onSave=JSON.parse(JSON.stringify(g.inventory.snapshot())),refreshed=game();refreshed.inventory.restore(onSave);
 assert.ok(refreshed.world.crt.open);assert.equal(refreshed.world.crt.screen.material.emissiveIntensity,.5);
 await refreshed.interactions.use(refreshed.world.crt);
 const offSave=JSON.parse(JSON.stringify(refreshed.inventory.snapshot())),again=game();again.inventory.restore(offSave);
 for(const state of ['normal','ruined','memory','burned','distorted']){
  again.world.env.set(state,'school',true);again.step();
  assert.equal(again.world.crt.open,false);assert.equal(again.world.crt.spill.intensity,0);
  assert.equal(again.world.crt.glow.intensity,0);assert.equal(again.world.crt.screen.material.emissiveIntensity,0);
 }
 again.inventory.restore({});assert.equal(again.world.crt.open,false,'Old saves migrate to switched off');
 await g.interactions.use(lightSwitch);assert.notEqual(g.player.lightsOut,before);assert.equal(crt.spill.intensity,.14);
});
test('the journal contains only carried names and found clues, with no hint system',async()=>{
 const g=game();assert.equal(g.interactions.hint,undefined);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('journalHint'));assert.ok(!html.includes('NEED A NUDGE'));
});
test('exploration starts without a held flashlight and the found light does not reintroduce batteries',async()=>{
 const g=game(),player=new Player(g.camera,g.world,g.audio,g.config);
 assert.equal(player.viewModel,undefined);assert.equal(player.flashlight,undefined);assert.equal(player.battery,undefined);
 assert.equal(g.world.flash,undefined);assert.equal(g.world.scene.getObjectByName('Held flashlight'),undefined);
 assert.equal(g.world.interactables.some(t=>t.item==='battery'),false);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const text of ['flashlightMeter','batteryCount','B REPLACE'])assert.equal(html.includes(text),false,text);
 assert.ok(html.includes('F LIGHT'));assert.ok(g.target('item_flashlight').fixed);
 g.inventory.restore({items:['lockerKey','battery'],batteries:9});
 assert.ok(g.inventory.has('lockerKey'));assert.equal(g.inventory.has('battery'),false);
 assert.equal(Object.hasOwn(g.inventory.snapshot(),'batteries'),false);
});

test('an unlocked opening intent survives a refresh, including long-frame sprint passage',async()=>{
 const g=game(),t=g.target('classroomGate'),d=t.door;
 g.inventory.items.add('classroomKey');g.player.position.set(-1.6,1.65,-16.5);
 await g.interactions.use(t);const ajarSave=g.inventory.snapshot();
 drive(g,[-1.6,1.65,-16.5],-2.35,0);
 assert.ok(d.open);g.inventory.restore(ajarSave);assert.equal(d.open,true);
 assert.equal(d.obstacle.enabled,false);
 const p=g.player,physics=new PlayerPhysics(p);p.position.set(-1.6,1.65,-16.5);
 for(let i=0;i<45;i++)physics.update(.06,-4.8*.06,0,false);
 assert.ok(p.position.x<-3.5);assert.ok(g.inventory.opened.has(d.id));
 const openSave=g.inventory.snapshot();g.inventory.restore(openSave);assert.ok(d.open);
});

test('pulling a door closed cannot trap a body standing in its frame',async()=>{
 const g=game(),t=g.target('classroomGate'),d=t.door;
 g.player.position.set(-1.6,1.65,-16.5);g.inventory.items.add('classroomKey');await g.interactions.use(t);
 drive(g,[-1.6,1.65,-16.5],-2.35,0);
 g.player.position.set(-3,1.65,-16.5);await g.interactions.use(t);assert.ok(d.open);
 g.player.position.set(-1.6,1.65,-16.5);await g.interactions.use(t);assert.equal(d.motorTarget,0);for(let i=0;i<100;i++)g.world.update(1/60,i/60,g.player);assert.equal(d.open,false);
});

test('the CRT service channel requires its powered selector, reveals a real code and opens a persistent physical cache',async()=>{
 const g=game(),service=g.target('crt_service'),cache=g.target('cache_crt'),crt=g.world.crt;
 await g.interactions.use(cache);assert.equal(cache.open,false);assert.equal(cache.crtLocked,true);
 await g.interactions.use(service);assert.equal(g.inventory.unlocked.has(service.id),false);
 await g.interactions.use(crt);assert.equal(g.world.crtSecret.mode,'static');
 g.inventory.items.add('secretKey');await g.interactions.use(service);assert.equal(cache.open,false,'Key alone does not power the feed');
 g.inventory.items.add('fuse');g.inventory.repairPower();g.step();assert.equal(g.world.crtSecret.mode,'ready');
 g.inventory.items.delete('secretKey');await g.interactions.use(service);assert.equal(cache.crtLocked,true);
 g.inventory.items.add('secretKey');await g.interactions.use(service);g.step();
 assert.equal(g.world.crtSecret.mode,'secret');assert.ok(crt.screen.material.map);assert.ok(cache.open);assert.equal(cache.crtLocked,false);
 assert.ok(g.inventory.notes.has(service.id));assert.doesNotMatch(service.note.body,/417/,'The journal keeps a clue rather than copying the screen solution');
 assert.ok(g.target('crt_crowbar').enabled);await g.interactions.use(g.target('crt_crowbar'));assert.ok(g.inventory.has('crowbar'));
 await g.interactions.use(crt);assert.equal(crt.screen.material.map,null);
 const save=JSON.parse(JSON.stringify(g.inventory.snapshot())),refreshed=game();refreshed.inventory.restore(save);refreshed.step();
 assert.equal(refreshed.world.crt.open,false);assert.equal(refreshed.world.crtSecret.cache.crtLocked,false);
 assert.equal(refreshed.target('crt_crowbar').enabled,false);assert.ok(refreshed.inventory.notes.has(service.id));
 await refreshed.interactions.use(refreshed.world.crt);assert.equal(refreshed.world.crtSecret.mode,'secret');
});

test('heavy hidden panels open by sustained body pressure, consume effort, stop at exhaustion and resume after rest',()=>{
 const g=game(),p=new Player(g.camera,g.world,g.audio,g.config);g.player=p;
 const door=g.target('secret_lostProperty');assert.ok(door.unlatched);assert.equal(door.requires,null);
 p.position.set(-14.55,1.65,-23.6);p.yaw=Math.PI/2;p.keys.add('KeyW');
 const initial=door.amount,before=p.stamina;
 for(let i=0;i<30;i++){p.update(1/60);g.world.update(1/60,i/60,p);}
 assert.ok(door.amount>initial&&door.amount<.32,'Opening is gradual, not an instant swing');assert.ok(p.stamina<before);
 const partial=JSON.parse(JSON.stringify(g.inventory.snapshot()));g.inventory.restore(partial);
 assert.ok(Math.abs(door.amount-partial.panelStates[door.id].amount)<1e-8,'Partial angle survives refresh');
 p.position.set(-14.55,1.65,-23.6);p.stamina=.05;
 for(let i=0;i<90;i++){p.update(1/60);g.world.update(1/60,i/60,p);}
 assert.equal(p.stamina,0);assert.ok(p.exhausted);
 const stopped=door.amount;
 for(let i=0;i<30;i++){p.update(1/60);g.world.update(1/60,i/60,p);}
 assert.equal(door.amount,stopped,'Holding into the panel cannot regenerate effort or keep opening it');
 p.keys.clear();for(let i=0;i<480;i++)p.update(1/60);
 assert.equal(p.stamina,g.config.sprintCapacity,'Standing clear restores effort');
 p.keys.add('KeyW');for(let i=0;i<300;i++){p.update(1/60);g.world.update(1/60,i/60,p);if(p.position.x<-15.8)break;}
 assert.ok(p.position.x<-15.8,'The same panel remains physically passable after recovering: '+JSON.stringify({position:p.position.toArray(),amount:door.amount,stamina:p.stamina}));
});
