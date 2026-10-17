import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {DIALOGUE} from '../src/data/dialogue.js';
import {VOICES} from '../src/data/voices.js';
import {loadMaraModel,createMara,animateMara} from '../src/world/mara.js';
import {loadHandModels} from '../src/world/hand-rig.js';
import {CinematicSystem} from '../src/systems/cinematics.js';
import {DialogueSystem} from '../src/systems/dialogue.js';
import {FlashlightSystem} from '../src/systems/flashlight.js';
import {BEATS} from '../src/data/beats.js';
const elements=new Map();
globalThis.document={querySelector(s){if(!elements.has(s))elements.set(s,{style:{},textContent:'',classList:{add(){},remove(){}}});return elements.get(s);}};
const buffer=async file=>{const b=await readFile(new URL('../assets/models/'+file,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
await loadMaraModel(await buffer('mara-base.glb'));
await loadHandModels({left:await buffer('hand-left-v14.glb'),right:await buffer('hand-right-v14.glb')});
function game(){
 const camera=new T.PerspectiveCamera(68,1.6,.06,90),scene=new T.Scene(),mara=createMara();scene.add(mara);
 const player={position:new T.Vector3(-5,1.65,-21),keys:new Set(),bob:0,physics:{},syncCamera(){camera.position.copy(this.position);camera.rotation.set(0,0,0);}};player.syncCamera();
 const audio={isSpeaking:false,line(){},stopLine(){},cue(){}};
 const g={camera,world:{scene,mara,memoryFigures:[new T.Group()]},player,audio,config:{cameraFov:68,dialogueTiming:.05},inventory:{has:()=>false},interactions:{},time:1};
 g.dialogue=new DialogueSystem(audio,g.config);g.cinematics=new CinematicSystem(g);g.flashlight=new FlashlightSystem(g);return g;
}
test('opening promises to meet at home and all twenty Eli recordings share one native English voice',()=>{
 assert.deepEqual(DIALOGUE.argument.slice(0,4).map(l=>l.text),[
  'Can you walk home with me today?',"I've got things to do.","It's nothing. I just don't like going that way alone.","I've got to go, Mara. I'll meet you back home."
 ]);
 assert.ok(BEATS.find(b=>b.id==='cassette').effects.some(e=>e.type==='cinematic'&&e.id==='argument'));
 const takes=Object.values(VOICES).filter(t=>t.character.startsWith('eli'));
 assert.equal(takes.length,20);
 for(const take of takes){assert.equal(take.voice,'en-US-GuyNeural');assert.equal(take.revision,35);assert.equal(take.engine,'microsoft-neural');}
});
test('the conversation shows both living children speaking, waits for all lines and restores exploration without teleporting',async()=>{
 const g=game(),position=g.player.position.clone(),m=g.world.mara,maraPosition=m.position.clone();
 const done=g.cinematics.play('argument');g.cinematics.update(.2);animateMara(m,.1,1);
 assert.ok(g.cinematics.youngEli.visible&&m.visible);assert.ok(m.userData.speaking);assert.ok(m.userData.speechMouth.visible);
 assert.ok(g.world.memoryFigures[0].userData.conversationHidden);
 assert.ok(g.player.position.equals(position));assert.ok(!g.camera.position.equals(position));
 g.dialogue.advance();g.cinematics.update(.2);
 assert.equal(m.userData.speaking,false);assert.equal(g.cinematics.youngEli.userData.speaking,true);
 const mouth=g.cinematics.youngEli.userData.mouth.scale.y;g.time+=.15;g.cinematics.update(.15);
 assert.notEqual(g.cinematics.youngEli.userData.mouth.scale.y,mouth);
 for(let i=0;i<5;i++){g.dialogue.update(1);g.cinematics.update(.01);await Promise.resolve();}
 await done;
 assert.equal(g.cinematics.active,null);assert.equal(g.cinematics.youngEli.visible,false);
 assert.ok(g.player.position.equals(position));assert.ok(g.camera.position.equals(position));assert.ok(m.position.equals(maraPosition));
 assert.equal(g.dialogue.current,null);assert.equal(g.world.memoryFigures[0].userData.conversationHidden,undefined);
});
test('cancelling a conversation stops its audio queue and cannot later cancel a different shot',async()=>{
 const g=game(),old=g.cinematics.play('argument');g.cinematics.update(.1);g.cinematics.cancel();await old;
 assert.equal(g.dialogue.current,null);assert.equal(g.cinematics.youngEli.visible,false);
 const next=g.cinematics.play('fireMemory');await Promise.resolve();assert.equal(g.cinematics.active.id,'fireMemory');g.cinematics.cancel();await next;
});
test('both hands exist before finding a light, persist while hiding and reach a moving handle or heavy door',()=>{
 const g=game();g.flashlight.update(.1,0);const view=g.flashlight.view;
 assert.ok(view.root.visible);assert.ok(view.hands.every(h=>h.root.visible));assert.equal(view.torch.visible,false);assert.equal(g.flashlight.beam,null);
 g.player.hidden={};g.flashlight.update(.1,1);assert.ok(view.root.visible);g.player.hidden=null;
 const handle=new T.Object3D();handle.position.copy(g.camera.position).add(new T.Vector3(-.15,-.25,-.7));g.world.scene.add(handle);
 const door={handles:[handle]};const initial=view.leftHand.position.clone();g.flashlight.reachDoor(door);g.flashlight.update(.25,2);
 assert.ok(view.leftHand.position.distanceTo(initial)>.1);
 const contact=g.flashlight.handContact(door,false);assert.ok(contact.equals(handle.position));
 g.flashlight.reachDoor(door,'push');g.flashlight.update(.1,3);g.flashlight.reachDoor(door,'push');g.flashlight.update(.1,3.1);
 assert.ok(view.root.visible);assert.ok(view.hands.every(h=>h.root.position.toArray().every(Number.isFinite)));
 g.flashlight.update(2,5);g.flashlight.update(.1,5.1);assert.equal(g.flashlight.doorAction,null);
 assert.ok(view.leftHand.position.distanceTo(initial)<.01,'Hands return to their idle pose');
 g.cinematics.play('argument');g.flashlight.update(.1,6);assert.equal(view.root.visible,false,'Third-person Eli supplies his own visible hands');g.cinematics.cancel();g.flashlight.update(.1,7);assert.ok(view.root.visible);
});
