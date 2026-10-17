import * as T from '../../vendor/three.module.js';

// A finite lamp cannot affect any visible surface when its entire influence sphere is outside the view.
export class LightCulling{
  constructor(){this.world=null;this.lights=[];this.frustum=new T.Frustum();this.matrix=new T.Matrix4();this.sphere=new T.Sphere();this.hidden=[];}
  begin(world,camera){
    if(world!==this.world){
      this.world=world;this.lights=[];
      world.scene.traverse(o=>{if(o.isPointLight&&o.distance>0)this.lights.push(o);});
    }
    camera.updateWorldMatrix(true,false);
    this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const light of this.lights){
      if(!light.visible)continue;
      this.sphere.radius=light.distance;light.getWorldPosition(this.sphere.center);
      if(light.intensity===0||!this.frustum.intersectsSphere(this.sphere)){light.visible=false;this.hidden.push(light);}
    }
  }
  end(){for(const light of this.hidden)light.visible=true;this.hidden.length=0;}
}
