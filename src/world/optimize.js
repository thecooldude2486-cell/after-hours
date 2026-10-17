import * as T from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';

// Bake only immobile, opaque scenery. Interactions, moving pivots and all colliders retain their objects.
export function batchStaticScenery(world){
  const {scene,env}=world;
  if(world.renderBatches)return world.renderBatches;
  const protectedObjects=new Set(world.interactables.map(t=>t.mesh));
  for(const f of world.lights)if(f.tube)protectedObjects.add(f.tube);
  const roles=new Set(['wall','floor','trim','desk','locker']),groups=new Map();
  scene.updateMatrixWorld(true);
  const identity=v=>v?.uuid||null;
  for(const e of env.entries){
    const m=e.mesh;
    if(!m.isMesh||(m.parent!==scene&&!m.parent?.userData.staticShell)||!m.visible||m.userData.collisionOnly||protectedObjects.has(m)||
      !roles.has(e.role)||m.material.transparent||Array.isArray(m.material))continue;
    // Custom visibility, geometry swaps or authored material changes must keep their independent mesh.
    if(e.variants&&Object.values(e.variants).some(v=>Object.keys(v).some(k=>k!=='material')))continue;
    const a=m.material;
    const signature=JSON.stringify([m.parent.uuid,e.role,e.room,m.parent===scene?Math.floor(m.position.x/12):0,m.parent===scene?Math.floor(m.position.z/12):0,
      a.color.getHex(),a.roughness,a.metalness,a.envMapIntensity,identity(a.map),identity(a.bumpMap),a.bumpScale,
      a.emissive.getHex(),a.emissiveIntensity,a.side,m.castShadow,m.receiveShadow,
      Object.entries(e.variants||{}).map(([state,v])=>[state,Object.entries(v.material||{}).map(([k,value])=>[k,value?.isTexture?identity(value):value])])]);
    if(!groups.has(signature))groups.set(signature,[]);
    groups.get(signature).push(e);
  }
  const removed=new Set(),batches=[];let meshesBefore=0;
  for(const entries of groups.values()){
    if(entries.length<2)continue;
    const geometries=entries.map(({mesh})=>mesh.geometry.clone().applyMatrix4(mesh.parent===scene?mesh.matrixWorld:mesh.matrix));
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const first=entries[0],batch=new T.Mesh(geometry,first.mesh.material.clone());
    batch.name='Static scenery / '+first.room+' / '+first.role;
    batch.castShadow=first.mesh.castShadow;batch.receiveShadow=first.mesh.receiveShadow;
    batch.matrixAutoUpdate=false;batch.updateMatrix();first.mesh.parent.add(batch);
    batches.push({mesh:batch,role:first.role,room:first.room,sourceCount:entries.length,variants:first.variants});
    for(const e of entries){e.mesh.parent.remove(e.mesh);removed.add(e);}
    meshesBefore+=entries.length;
  }
  env.entries=env.entries.filter(e=>!removed.has(e));
  for(const b of batches){
    env.register(b.mesh,b.role,b.room,b.variants);
  }
  world.renderBatches={meshesBefore,meshesAfter:batches.length,savedDraws:meshesBefore-batches.length,batches};
  return world.renderBatches;
}

export function instanceRain(world){
  if(world.rainBatches)return world.rainBatches;
  const batches=[];
  // windowAt authors eighteen streaks together, all with the same glass-rain material and geometry.
  for(let i=0;i<world.rain.length;i+=18){
    const drops=world.rain.slice(i,i+18),mesh=new T.InstancedMesh(drops[0].geometry,drops[0].material,drops.length);
    mesh.name='Instanced window rain';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for(let j=0;j<drops.length;j++){drops[j].updateMatrix();mesh.setMatrixAt(j,drops[j].matrix);world.scene.remove(drops[j]);}
    mesh.computeBoundingBox();mesh.boundingBox.min.y=.9;mesh.boundingBox.max.y=3.5;
    mesh.boundingSphere=mesh.boundingBox.getBoundingSphere(new T.Sphere());
    world.scene.add(mesh);batches.push({mesh,drops});
  }
  return world.rainBatches=batches;
}
