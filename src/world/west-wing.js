import * as THREE from '../../vendor/three.module.js';
/** A connected west annex: ordinary rooms, real locks and an optional supply route. */
export function addWestWing({scene,box,textPlane,floor,gate,interactables,builders}) {
  const {container,pickup,clue,grounding}=builders;
  const wallX=(x,a,b)=>{if(b>a)box(x,1.9,(a+b)/2,.23,3.8,b-a,0x666d65,'wall','westWing',true);};
  const wallZ=(z,a,b)=>{if(b>a)box((a+b)/2,1.9,z,b-a,3.8,.23,0x666d65,'wall','westWing',true);};
  floor(-16,-50,26,3,'westWing');
  floor(-29,-47,3,28,'westWing');
  wallZ(-51.5,-27.5,-3);wallZ(-48.5,-27.5,-3);
  wallZ(-61,-30.5,-27.5);wallZ(-33,-30.5,-27.5);
  for(const [a,b] of [[-61,-55.6],[-54.4,-39.6],[-38.4,-33]])wallX(-30.5,a,b);
  for(const [a,b] of [[-61,-56.6],[-55.4,-51.5],[-48.5,-40.6],[-39.4,-33]])wallX(-27.5,a,b);
  const rooms=[
    {id:'library',name:'LIBRARY',x:-37.25,z:-39,w:13.5,d:12,doorX:-30.5,doorZ:-39},
    {id:'infirmary',name:'INFIRMARY',x:-37.25,z:-55,w:13.5,d:12,doorX:-30.5,doorZ:-55,key:'clinicKey'},
    {id:'workshop',name:'WORKSHOP',x:-24.25,z:-56.5,w:6.5,d:9,doorX:-27.5,doorZ:-56,key:'workshopKey'},
    {id:'boiler',name:'BOILER ROOM',x:-24.25,z:-40,w:6.5,d:14,doorX:-27.5,doorZ:-40},
  ];
  for(const r of rooms){
    floor(r.x,r.z,r.w,r.d,r.id);
    wallX(r.x<-30.5?r.x-r.w/2:r.x+r.w/2,r.z-r.d/2,r.z+r.d/2);
    wallZ(r.z-r.d/2,r.x-r.w/2,r.x+r.w/2);wallZ(r.z+r.d/2,r.x-r.w/2,r.x+r.w/2);
    box(r.doorX,3,r.doorZ,.23,1.6,1.2,0x666d65,'wall',r.id,true);
    for(const side of [-1,1])box(r.doorX,1.1,r.doorZ+side*.59,.31,2.2,.06,0x5b6659,'trim',r.id,true);
    const d=gate('annex_'+r.id,r.doorX,r.doorZ,1.05,'Release '+r.name.toLowerCase()+' door',Math.PI/2,2.1);
    d.manual=true;d.requires=r.key;
    const t=interactables.find(t=>t.id===d.id);t.manual=true;t.requires=r.key;
    const face=r.doorX<-29?1:-1;
    textPlane(r.name,r.doorX+face*.17,2.4,r.doorZ,1.4,.28,face*Math.PI/2,'#c6c8b1','#273d34',31);
  }
  textPlane('WEST WING',-2.82,2.7,-50,1.8,.3,Math.PI/2,'#c6c8b1','#273d34',30);
  textPlane('LIBRARY   ↑\nINFIRMARY   ↓',-29,2.9,-49,2.1,.6,Math.PI/2,'#c6c8b1','#273d34',27);
  // Recessed tubes provide only a faint pool of light in the abandoned annex.
  for(const z of [-36,-44,-52,-59]){
    const tube=box(-29,3.6,z,.7,.04,.13,0x77877a,null,'westWing',false,{emissive:0x91a795,emissiveIntensity:.24});
    const light=new THREE.PointLight(0x91a795,.25,5.5,2);light.position.set(-29,3.4,z);scene.add(light);
  }
  // Library stacks have a wide middle aisle, with identifiable hollow-book storage.
  for(const x of [-42.6,-35.8])for(const z of [-35,-42.8]){
    box(x,1.1,z,3.1,2.2,.55,0x3b473d,'desk','library',true);
    for(let i=0;i<13;i++)box(x-1.38+i*.22,1.38+(i%2)*.28,z+.30,.13,.35,.18,[0x736247,0x465d51,0x614038][i%3]);
    for(const y of [.72,1.48])box(x,y,z,3.2,.045,.6,0x6c6551);
  }
  const book=container('annex_hollowBook','hollow library book',-39,.8,-38.7,.55,.2,.4);
  box(-39,.4,-38.7,1.8,.8,.9,0x494c3e,'desk','library',true);
  pickup('annex_clinicKey','clinicKey',book);
  const deskBox=container('annex_libraryDrawer','librarian’s desk box',-34,.85,-40.5,.72,.25,.5);
  box(-34,.4,-40.5,1.7,.8,.85,0x494c3e,'desk','library',true);
  pickup('annex_workshopKey','workshopKey',deskBox);
  clue('annex_libraryNote',-39,-40.5,'library');
  // Infirmary beds, curtain rail and a medicine case containing the hidden-room key.
  for(const z of [-51.5,-58.5]){
    box(-40,.48,z,3.8,.65,1.55,0x596759,'desk','infirmary',true);
    box(-40,.84,z,3.65,.1,1.45,0xb6b6a0);box(-41.25,.96,z,.7,.16,1.1,0xd0c8ac);
    for(const x of [-41.8,-38.2])box(x,.95,z,.05,1.7,1.6,0x687a6e);
  }
  const medicine=container('annex_medicineCase','nurse’s medicine case',-34,.88,-57.6,1,.4,.7);
  box(-34,.4,-57.6,1.4,.8,.9,0x494c3e,'desk','infirmary',true);
  pickup('annex_secretKey','secretKey',medicine,[-.22,.04,0]);
  pickup('annex_calm','groundingKit',medicine,[.22,.04,0]);
  clue('annex_nurseNote',-34,-52,'infirmary');
  grounding('ground_infirmary',-36,-54,'Rest beside the infirmary grounding card');
  // Tools are found as physical pieces in the workshop chest.
  box(-24.2,.88,-59.4,4,.16,1.15,0x514b3b,'desk','workshop',true);
  const tools=container('annex_toolChest','workshop tool chest',-24,.98,-59.4,1.4,.42,.8);
  pickup('annex_valveWheel','valveWheel',tools,[-.32,.04,0]);
  pickup('annex_pliers','pliers',tools,[.3,.04,0]);
  for(const z of [-54,-57])box(-21.35,1.3,z,.45,2.6,1.1,0x34443a,'locker','workshop',true);
  clue('annex_workshopNote',-25,-53.5,'workshop');
  // Steam separates the reachable shutoff from a useful fuse cache.
  const brass=new THREE.MeshStandardMaterial({color:0x8d886d,metalness:.6,roughness:.6});
  for(const z of [-44,-38,-35]){
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,2.2,20),brass);tank.position.set(-21.8,1.1,z);scene.add(tank);
  }
  box(-26,1.4,-43.12,.1,2.8,.1,0x7a7b63);
  box(-24.1,2.75,-43.12,3.9,.1,.1,0x7a7b63);
  const gauge=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.05,20),brass);gauge.rotation.x=Math.PI/2;gauge.position.set(-26,1.72,-43.01);scene.add(gauge);
  const needle=new THREE.Mesh(new THREE.BoxGeometry(.012,.085,.012),new THREE.MeshStandardMaterial({color:0x772d25}));needle.position.set(-26,1.74,-42.97);needle.rotation.z=-.7;scene.add(needle);
  const valveBase=box(-26,1.15,-43,.3,.5,.15,0x6e7760);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.15,.025,8,28),new THREE.MeshStandardMaterial({color:0x773b31,roughness:.7}));
  wheel.position.set(-26,1.2,-42.88);wheel.visible=false;scene.add(wheel);
  const steamCollider=box(-24,1.5,-40,.2,3,14,0,null,'boiler',true);steamCollider.visible=false;
  const clouds=[];
  const mist=new THREE.MeshStandardMaterial({color:0xaab9ac,transparent:true,opacity:.15,depthWrite:false,roughness:1});
  for(let i=0;i<21;i++){
    const puff=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),mist);
    puff.position.set(-24,1+(i%3)*.6,-46.5+i*.65);puff.scale.set(.3,.65,.55);scene.add(puff);clouds.push(puff);
  }
  const valve={id:'annex_steamValve',type:'valve',label:'Fit the steam shutoff wheel',mesh:valveBase,position:valveBase.position.clone(),enabled:true};interactables.push(valve);
  const fuseCase=container('annex_fuseCase','wired electrical case',-22,.7,-41.5,1,.35,.7,null,'pliers');
  box(-22,.31,-41.5,1.4,.62,.9,0x494c3e,'desk','boiler',true);
  pickup('annex_spareFuse','fuse',fuseCase,[-.2,.04,0]);
  const sync=opened=>{
    const fixed=opened.has(valve.id);valve.open=fixed;wheel.visible=fixed;needle.rotation.z=fixed?1.1:-.7;
    steamCollider.userData.obstacle.enabled=!fixed;
    for(const puff of clouds)puff.visible=!fixed;
    valve.label=fixed?'Steam isolated':'Fit the steam shutoff wheel';
  };
  sync(new Set());
  return {rooms,area:631,sync,steamCollider:steamCollider.userData.obstacle,clouds,wheel,valve};
}
