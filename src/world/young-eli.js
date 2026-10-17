import * as T from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';

/** Eli's living memory: a school jumper, backpack and independently posed face and arms. */
export function createYoungEli(){
  const root=new T.Group();root.name='Young Eli';root.visible=false;
  const skin=new T.MeshStandardMaterial({color:0xc59a7c,roughness:.8}),cloth=new T.MeshStandardMaterial({color:0x334d63,roughness:.95});
  const shirt=new T.MeshStandardMaterial({color:0xc8c1ad,roughness:.9}),dark=new T.MeshStandardMaterial({color:0x262a30,roughness:.9});
  const hair=new T.MeshStandardMaterial({color:0x30251e,roughness:1}),eye=new T.MeshStandardMaterial({color:0x171b1c});
  const sphere=new T.SphereGeometry(1,16,12),box=new T.BoxGeometry(1,1,1);
  const part=(parent,geometry,material,p,s)=>{const m=new T.Mesh(geometry,material);m.position.fromArray(p);m.scale.fromArray(s);parent.add(m);return m;};
  part(root,sphere,cloth,[0,.91,0],[.19,.285,.105]);
  part(root,box,shirt,[0,1.105,-.09],[.12,.12,.02]);
  part(root,sphere,dark,[0,.9,.14],[.16,.21,.08]);
  for(const x of [-.085,.085]){
    part(root,new T.CapsuleGeometry(.057,.48,4,10),dark,[x,.36,0],[1,1,1]);
    part(root,sphere,dark,[x,.055,-.045],[.07,.05,.13]);

  }
  const head=new T.Group();head.position.y=1.205;root.add(head);
  part(root,new T.CylinderGeometry(.04,.05,.12,10),skin,[0,1.16,0],[1,1,1]);
  part(head,sphere,skin,[0,.065,0],[.105,.135,.101]);
  part(head,sphere,skin,[0,.008,-.013],[.081,.067,.08]);
  part(head,sphere,hair,[0,.16,.014],[.109,.055,.099]);
  for(const side of [-1,1]){
    part(head,sphere,skin,[side*.105,.065,0],[.022,.033,.02]);
    part(head,sphere,eye,[side*.043,.08,-.093],[.017,.012,.01]);
    part(head,sphere,hair,[side*.043,.106,-.088],[.026,.005,.013]);
    part(head,sphere,hair,[side*.096,.11,.02],[.019,.06,.071]);
  }
  part(head,sphere,skin,[0,.048,-.102],[.014,.025,.019]);
  const mouth=part(head,sphere,new T.MeshBasicMaterial({color:0x38211f}),[0,-.007,-.099],[.026,.004,.005]);mouth.name='Eli speaking mouth';
  const arms=[-1,1].map(side=>{
    const joint=new T.Group();joint.position.set(side*.195,1.07,0);root.add(joint);
    part(joint,new T.CapsuleGeometry(.045,.36,4,10),cloth,[0,-.2,0],[1,1,1]);
    part(joint,sphere,skin,[0,-.445,-.01],[.036,.057,.025]);
    for(let i=0;i<4;i++)part(joint,sphere,skin,[(i-1.5)*.014,-.50,-.012],[.006,.026,.007]);
    return joint;
  });
  for(const joint of [root,head,...arms]){
    const groups=new Map();
    for(const m of [...joint.children])if(m.isMesh&&m!==mouth){
      m.updateMatrix();if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);
    }
    for(const [material,meshes] of groups)if(meshes.length>1){
      const parts=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix)),geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
      meshes.forEach(m=>joint.remove(m));joint.add(new T.Mesh(geometry,material));
    }
  }
  root.userData={head,mouth,arms,speaking:false};return root;
}
export function animateYoungEli(root,time,speaking){
  const r=root.userData;r.speaking=speaking;
  r.mouth.scale.y=speaking?.006+Math.abs(Math.sin(time*13))*.009:.003;
  r.head.rotation.set(-.10+(speaking?Math.sin(time*3.5)*.025:0),0,speaking?Math.sin(time*2.3)*.018:0);
  r.arms[0].rotation.x=speaking?.25+Math.sin(time*4)*.08:0;
  r.arms[0].rotation.z=speaking?-.10:0;
  r.arms[1].rotation.x=speaking?.07:0;
}
