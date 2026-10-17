import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {DEFAULTS} from '../src/data/config.js';
import {ECHO_ROOMS,REPEATED_SENTENCE} from '../src/data/echoes.js';
import {createEchoModel,animateEcho} from '../src/world/echo-models.js';
import {loadMaraModel} from '../src/world/mara.js';
import {createSchool} from '../src/world/school.js';
import {EchoSystem} from '../src/systems/echoes.js';
import {InventorySystem} from '../src/systems/inventory.js';
import {InteractionSystem} from '../src/systems/interaction.js';
import {blocked} from '../src/systems/navigation.js';

const elements=new Map(),ink=[];
const context=new Proxy({fillText(text){ink.push(text);}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>context}),addEventListener(){},querySelector(s){
  if(!elements.has(s)){const classes=new Set();elements.set(s,{style:{},innerHTML:'',textContent:'',classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)}});}
  return elements.get(s);
}};
const bytes=await readFile(new URL('../assets/models/mara-base.glb',import.meta.url));
await loadMaraModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
function game(){
  const g={world:createSchool({},DEFAULTS),config:{...DEFAULTS},started:true,paused:false,ended:false,recovering:false,
    teacher:{active:false},cinematics:{},dialogue:{},ambushes:{},cheats:{},cues:[],requestLock(){},
    player:{position:new T.Vector3(-9,1.65,-15),keys:new Set(),sanity:100},
    story:{stage:'drawing',triggers:{busy:false},companion:false,save(){},signal(){},refreshObjective(){},label:t=>t.label}};
  g.audio={cue:(name)=>g.cues.push(name)};
  g.inventory=new InventorySystem(g);g.interactions=new InteractionSystem(g);g.echoes=new EchoSystem(g);g.inventory.restore();
  g.target=id=>g.world.interactables.find(t=>t.id===id);
  return g;
}

test('all sixteen interiors have distinct writing teachers, repeated boards and articulated ash pupils',()=>{
  const g=game(),rooms=g.world.echoes.rooms;
  assert.equal(rooms.length,ECHO_ROOMS.length);
  assert.equal(new Set(rooms.map(r=>r.teacher.name)).size,rooms.length);
  assert.equal(new Set(rooms.map(r=>r.teacher.userData.variant)).size,rooms.length);
  assert.ok(ink.filter(t=>t===REPEATED_SENTENCE+'  '+REPEATED_SENTENCE).length>=rooms.length*9);
  for(const r of rooms){
    assert.equal(r.students.length,r.count);
    assert.ok(r.students.every(s=>s.userData.flames.length>=3));
    assert.ok(r.students.every(s=>!blocked(s.position.x,s.position.z,g.world.obstacles,.2)),r.id+' pupils stand clear of furniture');
    assert.ok(r.teacher.userData.arms[1].children.some(m=>m.geometry?.parameters?.height===.06));
  }
  assert.deepEqual(rooms.filter(r=>blocked(r.teacher.position.x,r.teacher.position.z,g.world.obstacles,.15)).map(r=>r.id),[],'Teachers stand clear of furniture');
  const h=g.world.echoes.headmaster,e=g.world.echoes.eli;
  assert.equal(h.userData.echoKind,'headmaster');assert.ok(h.userData.cane);
  assert.ok(h.userData.height>e.userData.height);
  assert.equal(e.userData.echoKind,'eli');assert.equal(e.userData.shadowKind,'eli');assert.ok(e.userData.blurRadius>=10);
  assert.ok(rooms.every(r=>r.students.every(s=>s.userData.head.userData.sculpted)));
  const a=createEchoModel('teacher',2),b=createEchoModel('teacher',3);
  a.visible=true;animateEcho(a,.1,1,{writing:true});
  assert.notEqual(a.userData.arms[1].rotation.x,b.userData.arms[1].rotation.x,'Independent writing poses');
});

test('pupils remain frozen while their heads track a walking visitor; drain, reading and memories remain safe',()=>{
  const g=game(),r=g.world.echoes.rooms.find(r=>r.id==='classroom'),s=r.students[0];
  s.position.set(-14.1,0,-17);g.player.position.set(-14.1,1.65,-13.5);
  const initial=s.position.clone(),bodyRotation=s.rotation.clone();
  const limbs=[...s.userData.arms,...s.userData.legs].map(j=>j.rotation.clone());
  for(let i=0;i<180;i++)g.echoes.update(1/60,i/60);
  assert.ok(r.group.visible&&r.entered);
  assert.ok(Math.abs(s.userData.head.rotation.y)>1);
  assert.ok(s.position.equals(initial));
  const headAngle=s.userData.head.rotation.y;
  g.player.position.x=-10;
  for(let i=0;i<120;i++)g.echoes.update(1/60,3+i/60);
  assert.notEqual(s.userData.head.rotation.y,headAngle);
  assert.ok(s.position.equals(initial));assert.ok(s.rotation.equals(bodyRotation));
  [...s.userData.arms,...s.userData.legs].forEach((j,i)=>assert.ok(j.rotation.equals(limbs[i])));
  assert.ok(Math.abs(s.position.x-r.x)<r.w/2&&Math.abs(s.position.z-r.z)<r.d/2);
  assert.equal(g.cues.filter(c=>c==='ashTurn').length,1,'One collective head turn per entry');
  assert.ok(Math.abs(g.player.sanity-(100-.16*5))<1e-6,'Drain does not multiply by six pupils');
  const sanity=g.player.sanity;
  const frozen=s.position.clone();g.interactions.reader=true;g.echoes.update(10,10);
  assert.ok(s.position.equals(frozen));assert.equal(g.player.sanity,sanity);
  g.interactions.reader=false;g.world.env.set('memory','school',true);g.echoes.update(10,20);
  assert.ok(g.world.echoes.rooms.every(r=>!r.group.visible));
  assert.equal(g.world.echoes.eli.visible,false);assert.equal(g.player.sanity,sanity);
  g.world.env.set('burned','school',true);g.story.companion=true;g.echoes.update(1,21);
  assert.ok(g.world.echoes.rooms.every(r=>!r.group.visible));
});

test('headmaster watching blocks the file; a fitted bell creates an opening and the recovered roll survives a reload',async()=>{
  const g=game(),h=g.world.echoes.headmaster;
  g.story.stage='headmaster';g.player.position.set(8,1.65,-18.5);h.position.set(8,0,-16);h.rotation.y=0;h.visible=true;g.echoes.headmasterActive=true;
  g.inventory.items.add('headmasterKey');
  assert.ok(g.echoes.blocksReading());
  await g.interactions.use(g.target('headmaster_file'));
  assert.equal(g.inventory.has('attendanceRoll'),false);
  await g.interactions.use(g.target('headmaster_bell'));
  assert.equal(g.echoes.distraction,0,'A bell with a missing part cannot ring');
  const book=g.target('annex_hollowBook');await g.interactions.use(book);
  g.world.update(1,1,g.player);g.inventory.syncStorage();
  await g.interactions.use(g.target('library_bellClapper'));
  await g.interactions.use(g.target('headmaster_bell'));
  assert.equal(g.echoes.blocksReading(),false);assert.equal(g.echoes.distraction,16);
  assert.ok(g.world.echoes.clapperVisual.visible);
  await g.interactions.use(g.target('headmaster_file'));
  assert.ok(g.inventory.has('attendanceRoll'));assert.ok(g.inventory.notes.has('headmaster_file'));
  g.interactions.close();const saved=g.inventory.snapshot();g.inventory.reset();g.inventory.restore(saved);
  assert.ok(g.inventory.has('attendanceRoll'));assert.ok(g.world.echoes.headmasterFile.open);
  assert.equal(g.target('library_bellClapper').enabled,false);
  g.inventory.notes.add('bracelet');g.interactions.openJournal();
  assert.match(document.querySelector('#journalClues').innerHTML,/For Eli, when he comes back/);
});

test('distorted Eli flashes as a black rushing silhouette on the required route, once per save, outside emotional scenes',()=>{
  const g=game(),e=g.world.echoes.eli;g.story.stage='fault';g.world.env.set('burned','school',true);
  g.player.position.set(17.5,1.65,-45);g.echoes.update(.1,1);
  assert.ok(e.visible);assert.equal(g.echoes.eliOrigin.x,18);assert.equal(g.echoes.eliOrigin.z,-49);
  assert.equal(e.userData.shadow,true);assert.equal(g.cues.filter(c=>c==='eliEcho').length,1);
  const player=g.player.position.clone(),sanity=g.player.sanity;
  for(let i=0;i<60;i++)g.echoes.update(1/60,2+i/60);
  assert.ok(g.player.position.equals(player),'The flash does not move the player');
  assert.ok(g.player.sanity>=sanity-.2,'Only the existing classroom exposure applies');
  assert.ok(g.echoes.seen.has('fault'));assert.equal(e.visible,false);
  const save=g.echoes.snapshot();g.echoes.reset(save);g.echoes.update(.1,4);assert.equal(e.visible,false);
  g.story.stage='reunion';g.echoes.update(1,5);assert.equal(e.visible,false);
  assert.ok(g.world.echoes.rooms.every(r=>!r.group.visible));
});
