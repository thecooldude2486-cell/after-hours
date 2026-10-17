import * as T from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';

const sphere=new T.SphereGeometry(1,16,12),box=new T.BoxGeometry(1,1,1);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.94,...extra});
let ashMap;
function ashSurface(){
  if(ashMap)return ashMap;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const g=canvas.getContext('2d');g.fillStyle='#b8b6ad';g.fillRect(0,0,256,256);
  for(let i=0;i<1800;i++){
    const n=Math.sin(i*78.23+4.6)*43758.5453,v=n-Math.floor(n);
    g.fillStyle=i%9===0?'#25282577':i%2?'#f2ecdb4a':'#51544c32';
    g.fillRect(v*256,((i*53)%256),1+(i%4),2+(i%9));
  }
  ashMap=new T.CanvasTexture(canvas);ashMap.colorSpace=T.SRGBColorSpace;
  return ashMap;
}
function part(parent,geometry,material,position,scale=[1,1,1]){
  const m=new T.Mesh(geometry,material);m.position.fromArray(position);m.scale.fromArray(scale);parent.add(m);return m;
}
function limb(root,x,y,length,radius,material){
  const joint=new T.Group();joint.position.set(x,y,0);root.add(joint);
  part(joint,new T.CapsuleGeometry(radius,length-radius*2,4,8),material,[0,-length/2,0]);
  return joint;
}
/** Independent articulated silhouettes, rather than recolored Mara or Mrs Vale. Forward is -Z. */
export function createEchoModel(kind='student',variant=0){
  const root=new T.Group();root.name=kind==='headmaster'?'The Headmaster':kind==='eli'?'Eli / reality fracture':kind==='teacher'?'Writing teacher '+(variant+1):'Ash pupil '+variant;
  const student=kind==='student',master=kind==='headmaster',eli=kind==='eli';
  const height=master?2.12:eli?1.76:student?1.3+(variant%3)*.065:1.65+(variant%4)*.055;
  const scale=height/1.8;
  const body=new T.Group();body.scale.set(scale,scale,scale);root.add(body);
  const cloth=mat(master?0x30353a:eli?0x59696b:student?0x96988e:[0x6b7166,0x65686f,0x7b6d62,0x647672][variant%4],{map:ashSurface(),bumpMap:ashSurface(),bumpScale:.002});
  const ash=mat(student?0xa7b0ad:[0xb2aba0,0x9c9990,0xc0b9a7][variant%3],{map:ashSurface(),bumpMap:ashSurface(),bumpScale:.001});
  const dark=mat(0x20201f),shirt=mat(0x928c7c),ember=mat(0x65231a,{emissive:0xe05217,emissiveIntensity:.65});
  // A shaped coat with shoulders, lapels and separate articulated limbs.
  part(body,new T.CylinderGeometry(master?.24:.19,master?.3:.22,.62,12),cloth,[0,1.03,0],[1,1,.64]);
  for(const side of [-1,1]){
    const lapel=part(body,box,shirt,[side*.07,1.24,-.125],[.09,.23,.022]);lapel.rotation.z=side*.26;
    part(body,sphere,cloth,[side*(master?.255:.2),1.27,0],[.065,.085,.065]);
  }
  const legs=[-1,1].map(side=>limb(body,side*.105,.77,.68,.065,dark));
  legs.forEach(leg=>part(leg,box,dark,[0,-.665,-.045],[.13,.085,.24]));
  const arms=[-1,1].map(side=>limb(body,side*(master?.29:.24),1.27,eli?.83:.59,.053,cloth));
  arms.forEach(arm=>{
    part(arm,sphere,ash,[0,eli?-.85:-.61,-.015],[.047,.07,.032]);
    for(let f=0;f<4;f++)part(arm,box,ash,[(f-1.5)*.017,eli?-.91:-.67,-.02],[.012,.072,.017]);
  });
  const head=new T.Group();head.position.set(0,1.48,0);body.add(head);
  part(body,new T.CylinderGeometry(.047,.06,.16,8),ash,[0,1.39,0]);
  part(head,sphere,ash,[0,.085,0],[master?.13:.108,.155,eli?.09:.108]);
  part(head,sphere,ash,[0,-.007,-.012],[.086,.085,.086]);
  part(head,new T.ConeGeometry(.027,.075,5),ash,[0,.072,-.11]).rotation.x=-Math.PI/2;
  for(const side of [-1,1]){
    part(head,sphere,dark,[side*.046,.1,-.094],[.026,.016,.016]);
    part(head,sphere,mat(0x737c75,{emissive:master?0xa16a35:0x7a6d51,emissiveIntensity:.15}),[side*.045,.1,-.109],[.004,.005,.003]);
    part(head,sphere,ash,[side*.105,.08,0],[.025,.043,.025]);
    const brow=part(head,sphere,ash,[side*.047,.124,-.095],[.039,.009,.017]);brow.rotation.z=side*.025;
    part(head,sphere,ash,[side*.061,.04,-.078],[.04,.029,.025]);
  }
  part(head,box,dark,[0,.004,-.091],[.055,.009,.012]);
  // Every teacher has a distinct head shape, hair silhouette and clothing details.
  const hair=mat(student?0x727874:[0x24221f,0x727064,0x3e3027,0x171c1c][variant%4],{map:ashSurface()});
  const scalp=part(head,sphere,hair,[0,.183,.016],[.112,.071,.105]);
  if(variant%3===1)part(head,sphere,hair,[0,.105,.105],[.075,.09,.06]);
  if(variant%3===2)for(const side of [-1,1])part(head,box,hair,[side*.101,.08,.018],[.03,.18,.12]);
  if(kind==='teacher'&&variant%2===0){
    for(const side of [-1,1])part(head,new T.TorusGeometry(.033,.003,4,12),shirt,[side*.044,.1,-.115],[1,.78,1]);
  }
  if(kind==='teacher'&&variant%3===0)part(body,new T.CylinderGeometry(.21,.29,.58,12),cloth,[0,.66,0],[1,1,.69]);
  if(master){
    scalp.scale.set(.13,.035,.115);
    const coat=part(body,new T.CylinderGeometry(.25,.35,.78,12),cloth,[0,.83,.018],[1,1,.7]);
    coat.userData.headmasterCoat=true;
    part(body,box,mat(0x70403a),[0,1.19,-.165],[.045,.28,.018]);
    part(head,sphere,dark,[0,-.03,-.025],[.088,.06,.083]);
    part(head,new T.TorusGeometry(.042,.005,5,16),mat(0x928068,{metalness:.6}),[.047,.1,-.122]);
    const cane=new T.Group();cane.position.set(0,-.49,-.06);arms[1].add(cane);
    part(cane,new T.CylinderGeometry(.012,.018,1,8),dark,[0,-.14,0]);
    part(cane,new T.TorusGeometry(.055,.014,6,12,Math.PI),mat(0xa38f62,{metalness:.7}),[.05,.36,0]);
    for(let i=0;i<5;i++)part(body,sphere,shirt,[.065,.68+i*.12,-.19],[.012,.012,.007]);
    root.userData.cane=cane;
  }
  if(eli){
    part(body,new T.CylinderGeometry(.19,.2,.2,12),cloth,[0,1.36,.065],[1,1,.65]);
    part(body,box,mat(0x283132),[0,1.03,.15],[.32,.43,.16]);
    head.rotation.z=-.28;arms[0].scale.y=1.3;arms[1].rotation.z=-.24;
    part(head,box,dark,[.01,.08,-.113],[.012,.22,.015]).rotation.z=.23;
  }
  // Surface ash and ember seams suggest the fire without wounds or graphic injury.
  for(let i=0;i<(student?12:6);i++){
    const x=Math.sin(i*9.3+variant)*.15,y=.76+(i%6)*.09;
    part(body,box,i%4===0?ember:dark,[x,y,-.133],[.016+(i%3)*.008,.012,.004]).rotation.z=i*.7;
  }
  const flames=[];
  const flamePositions=[[-.23,1.32,-.03],[.22,1.2,-.015],[-.12,.73,-.13],[.1,1.03,-.15],[.02,1.69,.02]];
  if(student)for(let i=0;i<flamePositions.length;i++){
    const flame=part(body,new T.ConeGeometry(.045,.36,5),mat(0xff9a37,{emissive:0xff661f,emissiveIntensity:1.3,transparent:true,opacity:.42,depthWrite:false}),flamePositions[i],[1,1,.4]);
    flame.rotation.z=(i-1)*.2;flames.push(flame);
    part(flame,new T.ConeGeometry(.025,.18,5),mat(0xffdda0,{emissive:0xffc75c,emissiveIntensity:1.1,transparent:true,opacity:.5,depthWrite:false}),[0,-.04,-.015]);
  }
  let flameInstances=null;
  if(flames.length){
    const outer=new T.InstancedMesh(flames[0].geometry,flames[0].material,flames.length);
    const inner=new T.InstancedMesh(flames[0].children[0].geometry,flames[0].children[0].material,flames.length);
    outer.name='Instanced ember flames';inner.name='Instanced flame cores';
    outer.instanceMatrix.setUsage(T.DynamicDrawUsage);inner.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // The original flame transforms are animation controls; only two meshes draw the whole set.
    for(let i=0;i<flames.length;i++){
      const f=flames[i];f.updateMatrix();f.children[0].updateMatrix();
      outer.setMatrixAt(i,f.matrix);inner.setMatrixAt(i,new T.Matrix4().multiplyMatrices(f.matrix,f.children[0].matrix));
      body.remove(f);
    }
    outer.computeBoundingSphere();inner.computeBoundingSphere();body.add(outer,inner);
    flameInstances={outer,inner,matrix:new T.Matrix4()};
  }
  root.userData={...root.userData,echoKind:kind,variant,height,body,head,arms,legs,flames,flameInstances,forward:-1};
  // Consolidate rigid detail on each joint; the moving pivots and flames stay independent.
  for(const joint of [body,head,...arms,...legs,root.userData.cane].filter(Boolean)){
    const batches=new Map();
    for(const mesh of [...joint.children])if(mesh.isMesh&&!mesh.material.transparent){
      mesh.updateMatrix();
      if(!batches.has(mesh.material))batches.set(mesh.material,[]);
      batches.get(mesh.material).push(mesh);
    }
    for(const [material,meshes] of batches)if(meshes.length>1){
      const geometries=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));
      const geometry=mergeGeometries(geometries);
      geometries.forEach(g=>g.dispose());
      if(geometry){meshes.forEach(m=>joint.remove(m));joint.add(new T.Mesh(geometry,material));}
    }
  }
  root.visible=false;
  return root;
}

export function animateEcho(root,dt,time,{writing=false,moving=false,gaze=null}={}){
  const r=root.userData;if(!root.visible)return;
  const phase=time*(moving?4.2:1.1)+r.variant;
  r.body.position.y=Math.sin(phase)*.005;
  r.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(phase+i*Math.PI)*.23:0);
  r.arms[0].rotation.x=moving?Math.sin(phase)*.16:0;
  if(writing){
    r.arms[1].rotation.set(2.25+Math.sin(time*3.1)*.11,0,.25+Math.sin(time*7)*.09);
    r.head.rotation.x=.13;
  }else{
    r.arms[1].rotation.x=moving?-Math.sin(phase)*.14:0;
    if(gaze){
      const desired=Math.atan2(-(gaze.x-root.position.x),-(gaze.z-root.position.z))-root.rotation.y;
      const delta=Math.atan2(Math.sin(desired-r.head.rotation.y),Math.cos(desired-r.head.rotation.y));
      r.head.rotation.y+=delta*(1-Math.exp(-dt*3.8));
      const dy=(gaze.y||1.65)-r.height*.87;
      r.head.rotation.x=T.MathUtils.clamp(-Math.atan2(dy,Math.hypot(gaze.x-root.position.x,gaze.z-root.position.z)),-.35,.35);
    }else r.head.rotation.y*=Math.exp(-dt*3);
  }
  for(let i=0;i<r.flames.length;i++){
    const f=r.flames[i];f.scale.y=.7+Math.sin(time*9+i*2.3)*.21;
    f.rotation.z=Math.sin(time*5+i)*.16;
    f.updateMatrix();
    if(r.flameInstances){
      const {outer,inner,matrix}=r.flameInstances;
      outer.setMatrixAt(i,f.matrix);inner.setMatrixAt(i,matrix.multiplyMatrices(f.matrix,f.children[0].matrix));
    }
  }
  if(r.flameInstances){
    const {outer,inner}=r.flameInstances;
    outer.material.opacity=.38+Math.sin(time*8+r.variant)*.08;
    outer.instanceMatrix.needsUpdate=true;inner.instanceMatrix.needsUpdate=true;
  }
}
