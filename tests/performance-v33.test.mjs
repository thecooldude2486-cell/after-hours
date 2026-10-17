import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptivePerformance} from '../src/systems/performance.js';
import {readSettings} from '../src/systems/settings.js';
import {SchoolRenderer} from '../src/systems/rendering.js';
import * as T from '../vendor/three.module.js';
function setup(mode='auto'){
 const changes=[],renderer={capabilities:{maxSamples:4},setPixelRatio:v=>changes.push(v)};
 const presentation={target:{samples:0,dispose(){}}},config={performanceMode:mode,pixelRatio:1.4,screenEffects:true,walkSpeed:2.35,sprintCapacity:4.5};
 const p=new AdaptivePerformance(renderer,presentation,config,2);
 const frames=(seconds,count,active=true)=>{for(let i=0;i<count;i++)p.update(seconds,active);};
 return {p,frames,presentation,config,changes};
}
test('sustained slow frames reduce pixel work and effects without changing saved preferences or gameplay',()=>{
 const {p,frames,presentation,config}=setup(),before={...config};
 assert.equal(p.ratio,1,'Auto starts at native CSS resolution instead of supersampling');
 frames(1/25,400);
 assert.equal(p.ratio,.55);assert.ok(presentation.lowPower);
 assert.deepEqual(config,before);
 assert.ok(p.ratio**2<.31,'Slow GPU renders less than a third of the starting pixels');
});
test('tab switches, pauses and a single loading stall do not lower quality, while sustained fast play can recover it',()=>{
 const {p,frames}=setup();
 frames(1/60,120);const before=p.ratio;
 frames(1,5);frames(1/30,300,false);frames(1/60,100);
 assert.equal(p.ratio,before);
 frames(1/30,150);const slow=p.ratio;assert.ok(slow<before);
 frames(1/60,2200);
 assert.ok(p.ratio>slow&&p.ratio<=1.2);
});
test('low and high modes apply immediately and do not override the player’s screen-effects preference',()=>{
 const {p,frames,config,presentation}=setup('low');assert.equal(p.ratio,.7);assert.ok(presentation.lowPower);
 frames(1/60,2000);assert.equal(p.ratio,.7);
 config.screenEffects=false;config.performanceMode='high';p.configure();
 assert.equal(p.ratio,1.4);assert.equal(presentation.lowPower,false);assert.equal(presentation.target.samples,2);assert.equal(config.screenEffects,false);
 config.performanceMode='low';p.configure();assert.equal(presentation.target.samples,0);
});
test('graphics preferences migrate safely and retain a valid saved low-power selection',()=>{
 assert.equal(readSettings({getItem:()=>null}).performanceMode,'auto');
 assert.equal(readSettings({getItem:()=>'{"performanceMode":"low"}'}).performanceMode,'low');
 assert.equal(readSettings({getItem:()=>'{"performanceMode":"broken"}'}).performanceMode,'auto');
});
test('low-power rendering bypasses the optional full-screen pass and preserves the figure blur path',()=>{
 const calls=[],r={capabilities:{maxSamples:4},getDrawingBufferSize:v=>v.set(800,500),setRenderTarget(){},render:(s,c)=>calls.push(s)};
 const p=new SchoolRenderer(r,{screenEffects:true}),world={scene:new T.Scene(),env:{state:'ruined'}},camera=new T.PerspectiveCamera();
 p.lowPower=true;p.render(world,camera,1);assert.equal(calls.length,1);assert.equal(p.uniforms.lensOnly.value,1);
 calls.length=0;p.lowPower=false;p.render(world,camera,2);assert.equal(calls.length,2);
 assert.ok(p.material.fragmentShader.includes('if(lensOnly<.5)'),'Lens-only figure mode skips the expensive optional shader loops');
});
