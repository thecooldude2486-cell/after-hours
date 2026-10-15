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
test('unlocked classroom door stays ajar at rest and body motion pushes it away from either side',async()=>{
 for(const side of [-1,1]){
 const g=game(),t=g.target('classroomGate'),d=t.door;
 const start=[-3+side*1.4,1.65,-16.5];g.player.position.set(...start);
 g.inventory.items.add('classroomKey');await g.interactions.use(t);
 const amount=d.amount;for(let i=0;i<90;i++)g.world.update(1/60,i/60,g.player);
 assert.equal(d.amount,amount);assert.equal(d.open,false);assert.ok(d.obstacle.enabled);
 const end=drive(g,start,-side*2.35,0);
 assert.ok(side===1?end.x<-3.5:end.x>-2.5,'Player crosses after pushing: '+JSON.stringify({side,end:end.toArray(),angle:d.angle}));
 assert.ok(d.amount>.32);assert.ok(g.inventory.opened.has(d.id));
 }
});
test('locked doors block movement and walking parallel to an ajar leaf does not push it',async()=>{
 const g=game(),t=g.target('classroomGate'),d=t.door;
 const end=drive(g,[-1.6,1.65,-16.5],-2.35,0,90);
 assert.ok(end.x>-3);assert.equal(d.open,false);
 g.inventory.items.add('classroomKey');await g.interactions.use(t);
 const a=d.amount;g.world.pushDoors({x:0,z:-10},0,-.1,.23);assert.equal(d.amount,a);
});
test('CRT only changes its screen and local light spill, and corridor switch is independent',async()=>{
 const g=game(),crt=g.target('crt'),lightSwitch=g.target('switch');
 assert.ok(crt.open);assert.ok(crt.spill.intensity>0&&crt.spill.intensity<.3);assert.ok(crt.spill.distance<4);
 const before=g.player.lightsOut;
 await g.interactions.use(crt);
 assert.equal(crt.open,false);assert.equal(crt.spill.intensity,0);assert.equal(crt.glow.intensity,0);
 assert.equal(crt.screen.material.emissiveIntensity,0);assert.equal(g.player.lightsOut,before);
 await g.interactions.use(lightSwitch);assert.notEqual(g.player.lightsOut,before);assert.equal(crt.spill.intensity,0);
 await g.interactions.use(crt);assert.equal(crt.spill.intensity,.14);assert.equal(crt.glow.intensity,.62);
 assert.notEqual(g.player.lightsOut,before);
});
test('the journal contains only carried names and found clues, with no hint system',async()=>{
 const g=game();assert.equal(g.interactions.hint,undefined);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('journalHint'));assert.ok(!html.includes('NEED A NUDGE'));
});

test('an unlatched save restores an ajar door, and long-frame sprint contact still opens it without tunnelling',async()=>{
 const g=game(),t=g.target('classroomGate'),d=t.door;
 g.inventory.items.add('classroomKey');g.player.position.set(-1.6,1.65,-16.5);
 await g.interactions.use(t);const ajarSave=g.inventory.snapshot();
 drive(g,[-1.6,1.65,-16.5],-2.35,0);
 assert.ok(d.open);g.inventory.restore(ajarSave);assert.equal(d.open,false);assert.ok(d.amount<.1);
 assert.ok(blocked(-3,-16.5,[d.obstacle],.23));
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
 g.player.position.set(-1.6,1.65,-16.5);await g.interactions.use(t);assert.equal(d.open,false);
});
