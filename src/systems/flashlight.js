import * as T from '../../vendor/three.module.js';
import {createFlashlightViewModel} from '../world/viewmodel.js';
/** Hands belong to the player from the start; the flashlight is still an earned tool. */
export class FlashlightSystem{
  constructor(game){this.game=game;this.view=null;this.beam=null;this.doorAction=null;}
  reset(){this.doorAction=null;}
  reachDoor(door,mode='open'){
    if(this.doorAction?.door===door&&this.doorAction.mode===mode){
      if(mode==='push')this.doorAction.ttl=.16;
      return;
    }
    this.doorAction={door,mode,elapsed:0,ttl:mode==='push'?.16:1.35};
  }
  handContact(door,push){
    const g=this.game;
    if(!push&&door.handles?.length){
      return door.handles.map(h=>h.getWorldPosition(new T.Vector3())).sort((a,b)=>a.distanceToSquared(g.camera.position)-b.distanceToSquared(g.camera.position))[0];
    }
    if(!door.width&&door.target?.position)return door.target.position.clone();
    if(door.hinge){
      door.hinge.updateWorldMatrix(true,true);
      const a=door.baseAxis||{x:1,z:0},c=Math.cos(door.angle||0),s=Math.sin(door.angle||0);
      const axis=new T.Vector3(a.x*c+a.z*s,0,-a.x*s+a.z*c);
      const start=door.hinge.position.clone(),offset=g.player.position.clone().sub(start);
      const along=T.MathUtils.clamp(offset.dot(axis),.18,(door.width||1)-.12);
      const contact=start.addScaledVector(axis,along);contact.y=g.camera.position.y-.35;
      const toward=g.player.position.clone().sub(contact);toward.y=0;toward.normalize();
      return contact.addScaledVector(toward,(door.thickness||.15)/2+.03);
    }
    return door.position?.clone?.()||g.camera.position.clone().add(g.camera.getWorldDirection(new T.Vector3()));
  }
  update(dt,time){
    const g=this.game,owned=g.inventory.has('flashlight');
    if(!this.view)this.view=createFlashlightViewModel(g.camera,g.world.scene);
    if(owned&&!this.beam){
      this.beam=new T.SpotLight(0xe5ebd3,0,22,Math.PI/7,.6,1.35);
      this.beam.name='Found flashlight beam';this.beam.castShadow=false;
      g.world.scene.add(this.beam,this.beam.target);
    }
    const visible=g.started!==false&&!g.ended&&!g.cinematics.active?.data?.conversation;
    const on=visible&&owned&&g.inventory.flashlightOn&&!g.player.hidden&&!g.interactions.reader&&!g.cinematics.active;
    const a=this.doorAction;
    let amount=0,door=null,push=false;
    if(a){
      a.elapsed+=dt;a.ttl-=dt;push=a.mode==='push';
      amount=Math.min(1,a.elapsed/.20)*Math.min(1,Math.max(0,a.ttl)/(push?.10:.25));
      door=this.handContact(a.door,push);
      if(a.ttl<=0)this.doorAction=null;
    }
    this.view.update(g.player,time,{owned,door,amount,push});this.view.root.visible=visible;
    this.view.fill.intensity=visible?(on?.11:.035):0;
    this.view.lens.material.emissiveIntensity=on?.9:.02;
    if(!this.beam)return;
    g.camera.updateMatrixWorld(true);
    this.beam.position.copy(this.view.muzzle());
    const aim=g.camera.getWorldDirection(new T.Vector3());
    this.beam.target.position.copy(g.camera.position).addScaledVector(aim,12);
    this.beam.intensity=on?18:0;
  }
  toggle(){
    const g=this.game;if(!g.inventory.has('flashlight'))return;
    g.inventory.flashlightOn=!g.inventory.flashlightOn;
    g.audio.cue('switch');g.inventory.draw();g.story.save?.();
  }
}
