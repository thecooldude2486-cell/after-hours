import * as THREE from '../../vendor/three.module.js';
import {APPARITION_TUNING as STYLE} from '../data/hauntings.js';
import {createShadowFigure,animateShadow,SHADOW_LAYER} from './shadow-figure.js';
export const APPARITION_LAYER=SHADOW_LAYER;
/** A clipped black head and shoulder peeking from a fixed doorway edge. */
export class DistantFigure{
  constructor(scene){
    this.mesh=createShadowFigure('peek');scene.add(this.mesh);
    this.materials=this.mesh.userData.materials;this.material=this.materials[0];
    this.blurRadius=STYLE.blurPixels;this.clipPlanes=[];
  }
  setPeek(event,actor){
    if(actor)actor.visible=false;
    const axis=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),event.peekYaw||0);
    this.mirror=event.mirror?-1:1;this.axis=axis;
    this.mesh.position.set(event.at[0],0,event.at[1]).addScaledVector(axis,this.mirror*(event.peekYaw?.4:.25));
    this.mesh.rotation.set(0,event.peekYaw||0,this.mirror*.015);
    this.peekPosition=this.mesh.position.clone();
    const normal=axis.clone().multiplyScalar(-this.mirror);
    this.clipPlanes=[
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal,this.peekPosition.clone().addScaledVector(normal,STYLE.edgeInset)),
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().negate(),this.peekPosition.clone().addScaledVector(normal,STYLE.edgeInset+STYLE.visibleStrip)),
      new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1.28,0)),
    ];
    for(const m of this.materials){m.clippingPlanes=this.clipPlanes;m.needsUpdate=true;}
    this.mesh.visible=true;
  }
  sightPoint(event){
    return new THREE.Vector3(event.at[0],1.8,event.at[1]).add(new THREE.Vector3((event.mirror?-1:1)*(event.peekYaw?.35:.2),0,0).applyAxisAngle(new THREE.Vector3(0,1,0),event.peekYaw||0));
  }
  retreat(amount){this.mesh.position.copy(this.peekPosition).addScaledVector(this.axis,this.mirror*amount*STYLE.retreatDistance);}
  update(camera,opacity=.98,time=0){
    this.material.opacity=opacity;
    for(let i=1;i<this.materials.length;i++)this.materials[i].opacity=opacity*.1/i;
    animateShadow(this.mesh,time,.08);
  }
  hide(){this.mesh.visible=false;}
}
