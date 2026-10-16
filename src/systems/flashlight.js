import * as T from '../../vendor/three.module.js';
import {createFlashlightViewModel} from '../world/viewmodel.js';
/** A found tool, with the existing authored power grip. No battery grind. */
export class FlashlightSystem{
  constructor(game){this.game=game;this.view=null;this.beam=null;}
  update(dt,time){
    const g=this.game,owned=g.inventory.has('flashlight');
    if(owned&&!this.view){
      this.view=createFlashlightViewModel(g.camera,g.world.scene);
      this.beam=new T.SpotLight(0xe5ebd3,0,22,Math.PI/7,.6,1.35);
      this.beam.name='Found flashlight beam';this.beam.castShadow=false;
      g.world.scene.add(this.beam,this.beam.target);
    }
    if(!this.view)return;
    const visible=owned&&!g.player.hidden&&!g.cinematics.active&&!g.interactions.reader&&!g.ended;
    const on=visible&&g.inventory.flashlightOn;
    this.view.update(g.player,time);this.view.root.visible=visible;
    this.view.fill.intensity=on?.11:0;
    this.view.lens.material.emissiveIntensity=on?.9:.02;
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
