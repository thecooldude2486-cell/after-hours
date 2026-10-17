import * as T from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';
export const SHADOW_LAYER=2;
/** A solid human-shaped absence with two faint motion trails. The renderer softens only its silhouette. */
export function createShadowFigure(kind='peek'){
  const root=new T.Group(),parts=[],sphere=new T.SphereGeometry(1,16,12);
  root.name=kind==='eli'?'Eli / black reality fracture':'Blurred black '+kind;
  const oval=(p,s)=>{const m=new T.Object3D();m.position.fromArray(p);m.scale.fromArray(s);m.updateMatrix();parts.push(sphere.clone().applyMatrix4(m.matrix));};
  oval([0,1.72,0],[.115,.158,.105]);oval([0,1.53,.015],[.05,.09,.05]);
  oval([0,1.19,.025],[.22,.34,.115]);oval([0,.86,.02],[.175,.17,.11]);
  for(const side of [-1,1]){
    oval([side*.215,1.41,.02],[.095,.1,.085]);
    oval([side*.255,1.21,.025],[.063,.23,.065]);
    oval([side*.28,.88,0],[.045,.20,.045]);
    oval([side*.285,.655,-.015],[.043,.085,.032]);
    for(let i=0;i<3;i++)oval([side*.285+(i-1)*.021,.565,-.018],[.009,.07,.011]);
    oval([side*.09,.48,.025],[.068,.35,.07]);
    oval([side*.09,.09,-.035],[.075,.06,.14]);
  }
  if(kind==='eli')oval([0,1.16,.16],[.21,.26,.11]);
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());sphere.dispose();geometry.computeBoundingSphere();
  const material=new T.MeshBasicMaterial({color:0x010202,transparent:true,opacity:.98,depthWrite:true,fog:false,toneMapped:false});
  const body=new T.Mesh(geometry,material);body.name='Featureless black silhouette';root.add(body);
  const materials=[material],trails=[];
  for(let i=0;i<2;i++){
    const mat=material.clone();mat.opacity=.1/(i+1);mat.depthWrite=false;
    const trail=new T.Mesh(geometry,mat);trail.name='Soft shadow motion trail';trail.position.x=(i+1)*.025;trail.scale.set(1+(i+1)*.035,1,1);
    root.add(trail);materials.push(mat);trails.push(trail);
  }
  root.traverse(o=>o.layers.enable(SHADOW_LAYER));
  root.userData={shadow:true,echoKind:kind,shadowKind:kind,height:1.9,body,materials,trails,blurRadius:kind==='peek'?7:11};
  root.visible=false;return root;
}
export function animateShadow(root,time,impact=0){
  const r=root.userData;
  for(let i=0;i<r.trails.length;i++){
    r.trails[i].position.x=(i+1)*(.025+impact*.065)*Math.sin(time*31+i*.8);
    r.trails[i].scale.x=1+(i+1)*(.035+impact*.1);
  }
}
