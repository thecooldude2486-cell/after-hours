import * as T from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';
/** Thin metal fittings leave a genuinely open cavity. Local +Z is the opening. */
export function addLockerInterior(root,w,h,d,{shelf=1.02}={}){
  const parts=[];
  const lining=new T.MeshStandardMaterial({color:0x899188,roughness:.96,metalness:0,envMapIntensity:0,emissive:0x38483d,emissiveIntensity:.1});
  const metal=new T.MeshStandardMaterial({color:0x778077,metalness:.15,roughness:.9,envMapIntensity:.04});
  const dark=new T.MeshStandardMaterial({color:0x28332f,roughness:1,envMapIntensity:0});
  const part=(name,x,y,z,a,b,c,mat=lining)=>{
    const m=new T.Mesh(new T.BoxGeometry(a,b,c),mat);m.name=name;m.position.set(x,y,z);root.add(m);parts.push(m);return m;
  };
  part('Pale locker interior',0,h/2,-d/2+.035,w-.085,h-.12,.012);
  part('Locker shelf liner',0,shelf+.023,.015,w-.09,.012,d-.09);
  for(const side of [-1,1]){
    part('Folded shelf support',side*(w/2-.055),shelf-.015,0,.025,.075,d-.11,metal);
    part('Folded inner door jamb',side*(w/2-.035),h/2,d/2-.025,.035,h-.09,.045,metal);
    for(const y of [.22,shelf+.14,h-.22]){
      const bolt=new T.Mesh(new T.CylinderGeometry(.012,.012,.009,8),metal);
      bolt.rotation.x=Math.PI/2;bolt.position.set(side*(w/2-.08),y,-d/2+.048);bolt.name='Interior rivet';root.add(bolt);parts.push(bolt);
    }
  }
  const high=Math.min(h-.32,1.78);
  part('Upper locker shelf',0,high,0,w-.09,.025,d-.08,metal);
  for(const x of [-w*.23,w*.23]){
    const hook=new T.Mesh(new T.TorusGeometry(.032,.006,6,12,Math.PI*1.35),metal);
    hook.position.set(x,high-.19,-d/2+.065);hook.rotation.y=Math.PI/2;hook.name='Coat hook';root.add(hook);
    part('Coat hook plate',x,high-.15,-d/2+.05,.07,.09,.013,metal);
  }
  part('Locker floor insert',0,.065,0,w-.1,.012,d-.09,dark);
  // Seams and scuffs are surface detail, not opaque panels in front of the contents.
  for(let i=0;i<7;i++)part('Worn interior seam',-w*.32+(i%3)*w*.18,.18+i*.16,-d/2+.043,.002,.045+(i%2)*.025,.002,dark);
  for(const mat of [lining,metal,dark]){
    const batch=parts.filter(m=>m.material===mat&&!['Pale locker interior','Locker shelf liner'].includes(m.name));
    const copies=batch.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
    if(!copies.length)continue;
    const geometry=mergeGeometries(copies);copies.forEach(g=>g.dispose());
    if(geometry){batch.forEach(m=>root.remove(m));const m=new T.Mesh(geometry,mat);m.name='Batched locker fittings';root.add(m);}
  }
  return {lining,metal};
}
