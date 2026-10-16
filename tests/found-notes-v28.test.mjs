import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {CLUES} from '../src/data/clues.js';
import {NOTES} from '../src/data/notes.js';
import {InteractionSystem} from '../src/systems/interaction.js';
import {ageNote} from '../src/world/aged-paper.js';

function setup() {
  const elements=new Map();
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  globalThis.document={
    createElement:()=>({getContext:()=>context}),
    querySelector(selector) {
      if(!elements.has(selector)) {
        const classes=new Set();
        elements.set(selector,{style:{},textContent:'',innerHTML:'',classList:{
          add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),
        }});
      }
      return elements.get(selector);
    },
  };
  const game={teacher:{active:false},config:{},player:{keys:new Set()},audio:{cue(){}},
    world:{interactables:[]},inventory:{items:new Set(),notes:new Set()},requestLock(){}};
  return {game,ui:selector=>document.querySelector(selector),system:new InteractionSystem(game)};
}

test('journal shows only collected clues, including old-save IDs, and safely renders item names',()=>{
  const {game,ui,system}=setup();
  system.openJournal();
  assert.match(ui('#journalClues').innerHTML,/No scraps collected/);
  assert.ok(!ui('#journalClues').innerHTML.includes(CLUES.annex_workshopNote.body));
  system.close();
  game.inventory.items.add('<img src=x onerror=alert(1)>');
  game.inventory.notes.add('clue_reception');
  game.inventory.notes.add('crt_service');
  system.openJournal();
  assert.match(ui('#journalItems').innerHTML,/&lt;img/);
  assert.ok(!ui('#journalItems').innerHTML.includes('<img'));
  assert.ok(ui('#journalClues').innerHTML.includes(CLUES.clue_reception.body));
  assert.ok(ui('#journalClues').innerHTML.includes(CLUES.crt_service.body));
  assert.doesNotMatch(ui('#journalClues').innerHTML,/417|Pressure warning/);
  assert.equal((ui('#journalClues').innerHTML.match(/<article/g)||[]).length,2);
  assert.ok(ui('#hud').classList.contains('reading'));
  assert.ok(ui('#reader .paper').classList.contains('journal'));
  system.close();
  assert.equal(ui('#hud').classList.contains('reading'),false);
});

test('notes, photographs, journal and keypad keep distinct presentations across repeated visits',()=>{
  const {system,ui}=setup(),paper=ui('#reader .paper');
  system.openJournal();
  system.close();
  system.read(CLUES.clue_tools);
  assert.ok(paper.classList.contains('aged-note'));
  assert.equal(paper.classList.contains('journal'),false);
  assert.equal(paper.classList.contains('keypad-view'),false);
  assert.match(ui('#closeReader').innerHTML,/PUT IT DOWN/);
  system.close();
  system.read(NOTES.photo);
  assert.ok(paper.classList.contains('visual'));
  assert.equal(paper.classList.contains('aged-note'),false);
  assert.equal(ui('#readImage').src,NOTES.photo.image);
  system.close();
  system.openKeypad({id:'vault'});
  assert.ok(paper.classList.contains('keypad-view'));
  assert.equal(paper.classList.contains('visual'),false);
  assert.doesNotMatch(ui('#readBody').textContent,/417|projector/i);
  system.close();
  system.openJournal();
  assert.ok(paper.classList.contains('journal'));
  assert.equal(paper.classList.contains('keypad-view'),false);
});

test('found sheets have physical folds and torn alpha silhouettes without changing their dimensions',()=>{
  setup();
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(.72,.44),new THREE.MeshStandardMaterial());
  ageNote(sheet,CLUES.clue_reception.title,4);
  assert.equal(sheet.geometry.parameters.width,.72);
  assert.equal(sheet.geometry.parameters.height,.44);
  const relief=Array.from(sheet.geometry.attributes.position.array).filter((_,i)=>i%3===2);
  assert.ok(Math.max(...relief)-Math.min(...relief)>.01);
  assert.ok(sheet.material.alphaMap?.isCanvasTexture);
  assert.equal(sheet.material.alphaTest,.5);
  assert.equal(sheet.material.transparent,true);
  assert.equal(sheet.material.map.colorSpace,THREE.SRGBColorSpace);
  assert.ok(sheet.userData.agedNote);
});
