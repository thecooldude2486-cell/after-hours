import { releaseDoor, updatePushDoor } from "./push-doors.js";
import * as THREE from '../../vendor/three.module.js';
import { ITEMS } from '../data/items.js';

/** Optional physical rooms and nested caches. Required story items keep their original locations. */
export function addSecrets({scene, box, textPlane, interactables, storage, env}) {
  const panels=[];
  const paint = new THREE.MeshStandardMaterial({color:0x34433a,roughness:.95});
  const brass = new THREE.MeshStandardMaterial({color:0x9d8d59,metalness:.65,roughness:.45});
  const paper = new THREE.MeshStandardMaterial({color:0xc6b996,roughness:.95});
  function part(root,w,h,d,x,y,z,mat=paint) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);root.add(m);return m;
  }
  function room(id,x,z,w,d,exitZ=null) {
    box(x,-.12,z,w,.24,d,0x373e3d,'floor',id);
    box(x,3.87,z,w,.16,d,0x646a62,'ceiling',id);
    const back=x<0?x-w/2:x+w/2;
    if(exitZ===null) box(back,1.9,z,.23,3.8,d,0x666d65,'wall',id,true);
    else for(const [a,b] of [[z-d/2,exitZ-.9],[exitZ+.9,z+d/2]]) box(back,1.9,(a+b)/2,.23,3.8,b-a,0x666d65,'wall',id,true);
    for(const side of [-1,1])box(x,1.9,z+side*d/2,w,3.8,.23,0x666d65,'wall',id,true);
  }
  room('lostProperty',-17.5,-23.25,5,3.5);
  room('serviceCache',22.5,-52.5,5,5,-52.5);
  room('mapStore',17.5,-22,5,5);
  room('projection',-17.5,-40,5,6);
  room('evidenceVault',27.5,-52.5,5,5,-52.35);
  box(31.6,-.12,-52.35,3.2,.24,4.6,0x373e3d,'floor','outside');
  function panel(id,x,z,label,requires=null,signText=null) {
    const mesh=box(x,1.6,z,.22,3.2,1.78,0x34433a,'trim','school',true);
    const hinge=new THREE.Group();hinge.position.set(x,0,z-.89);scene.add(hinge);hinge.attach(mesh);
    const side=x<0?1:-1;
    part(hinge,.035,.14,.12,side*.13,1.5,.41,brass);
    part(hinge,.025,.15,.09,side*.135,1.32,.41,brass);
    part(hinge,.012,.035,.022,side*.154,1.34,.41,new THREE.MeshStandardMaterial({color:0x101713}));
    // A visible screw/handle and small mismatch in the trim reward careful inspection.
    const sign=textPlane(signText||(x<0?'LOST PROPERTY':'SERVICE'),x+side*.135,1.75,z,.72,.22,side*Math.PI/2,'#a9a58a','#34433a',26);
    scene.updateMatrixWorld(true);hinge.attach(sign);
    const target={id,type:'secretDoor',secretKey:'secretKey',label,mesh:hinge,position:new THREE.Vector3(x,1.5,z),requires,
      open:false,amount:0,homeZ:z,hinge,width:1.78,thickness:.22,rotation:0,baseAxis:{x:0,z:1},angle:0,obstacle:mesh.userData.obstacle,enabled:true};
    hinge.userData.obstacle=target.obstacle;
    interactables.push(target);panels.push(target);
    // Solid lintel above the real gap.
    box(x,3.5,z,.23,.6,1.8,0x666d65,'wall','school',true);
    return target;
  }
  panel('secret_lostProperty',-15,-23.6,'Release the loose lost-property panel');
  panel('secret_serviceCache',20,-52.5,'Unlock the concealed service panel','serviceKey');
  const mapPanel=panel('secret_mapStore',15,-22,'Unscrew the map-store panel','screwdriver','MAP STORE');
  for(const y of [-1.25,1.25]) for(const z of [-.67,.67]) {
    const screw=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.025,12),brass);
    screw.rotation.z=Math.PI/2;screw.position.set(-.135,y+1.6,z+.89);mapPanel.mesh.add(screw);
    part(mapPanel.mesh,.012,.012,.04,-.155,y+1.6,z+.89,paint);
  }
  const boothPanel=panel('secret_projection',-15,-40,'Pry boards from the projection booth','crowbar','PROJECTION');
  boothPanel.barriers=[];
  const wood=new THREE.MeshStandardMaterial({color:0x6b5138,roughness:1});
  for(const tilt of [-.42,.42]) {
    const board=part(boothPanel.mesh,.09,.19,1.98,.19,1.2,.89,wood);board.rotation.x=tilt;boothPanel.barriers.push(board);
    for(const z of [-.6,.6])part(board,.018,.035,.035,.055,0,z,brass);
  }
  const vault=panel('secret_vault',25,-52.5,'Enter the vault code',null,'RECORD VAULT');
  vault.code='417';
  part(vault.mesh,.04,.4,.29,-.14,1.88,.38,paint);
  for(let y=0;y<4;y++)for(let z=0;z<3;z++)part(vault.mesh,.025,.037,.037,-.17,2.01-y*.075,.3+z*.075,brass);
  function container(id,title,x,y,z,w=.95,h=.52,d=.72,parent=null,requires=null) {
    const root=new THREE.Group();root.position.set(x,y,z);(parent?parent.tray:scene).add(root);
    part(root,w,.04,d,0,.02,0);
    part(root,.04,h,d,-w/2,h/2,0);part(root,.04,h,d,w/2,h/2,0);
    part(root,w,h,.04,0,h/2,-d/2);part(root,w,h,.04,0,h/2,d/2);
    const lid=new THREE.Group();lid.position.set(0,h,-d/2);root.add(lid);
    part(lid,w,.035,d,0,0,d/2);
    part(lid,.15,.025,.035,0,-.04,d,brass);
    const tray=new THREE.Group();tray.position.y=.07;root.add(tray);
    const t={id,type:'container',kind:'case',title,label:'Open '+title,mesh:lid,root,tray,position:new THREE.Vector3(),
      fixed:true,parentContainer:parent,requires,open:false,amount:0,animation:'lid',enabled:!parent};
    root.updateWorldMatrix(true,true);lid.getWorldPosition(t.position);
    if(!parent){const shell=box(x,y+h/2,z,w,h,d,0,null,'school',true);shell.visible=false;root.userData.obstacle=shell.userData.obstacle;lid.userData.obstacle=shell.userData.obstacle;}
    storage.push(t);interactables.push(t);return t;
  }
  function pickup(id,item,parent,at=[0,.04,0]) {
    const root=new THREE.Group();root.position.fromArray(at);parent.tray.add(root);
    if(ITEMS[item]?.type==='key'){
      const keyMetal=item==='secretKey'?new THREE.MeshStandardMaterial({color:0x919894,metalness:.65,roughness:.5}):brass;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.04,.009,8,20),keyMetal);ring.rotation.x=Math.PI/2;root.add(ring);
      part(root,.12,.015,.02,.075,.01,0,keyMetal);part(root,.025,.015,.04,.12,.01,.01,keyMetal);
    } else if(item==='cutters'||item==='pliers') {
      for(const side of [-1,1]){const handle=part(root,.035,.025,.3,side*.065,.02,.08,new THREE.MeshStandardMaterial({color:0x702e29}));handle.rotation.y=side*.12;const jaw=part(root,.03,.03,.15,side*.03,.02,-.13,brass);jaw.rotation.y=-side*.2;}
    } else if(item==='valveWheel') {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.1,.018,8,24),new THREE.MeshStandardMaterial({color:0x773b31}));ring.rotation.x=Math.PI/2;ring.position.y=.025;root.add(ring);
      for(const a of [0,Math.PI/2]){const spoke=part(root,.2,.018,.018,0,.025,0,brass);spoke.rotation.y=a;}
    } else if(item==='screwdriver') {
      part(root,.04,.025,.21,0,.02,-.06,brass);part(root,.06,.045,.13,0,.025,.1,new THREE.MeshStandardMaterial({color:0xb9903b}));
    } else if(item==='crowbar') {
      part(root,.035,.035,.45,0,.025,0,brass);const hook=part(root,.1,.035,.035,.035,.025,-.21,brass);
    } else if(item==='crank') {
      part(root,.21,.03,.03,0,.02,0,brass);part(root,.03,.03,.15,-.1,.02,-.06,brass);part(root,.04,.07,.04,.1,.04,0,paint);
    } else if(item==='fuse') {
      const ceramic=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.14,14),paper);ceramic.rotation.x=Math.PI/2;ceramic.position.y=.035;root.add(ceramic);
      for(const z of [-.06,.06]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.037,.037,.025,14),brass);cap.rotation.x=Math.PI/2;cap.position.set(0,.035,z);root.add(cap);}
    } else if(item==='battery') {
      const cell=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.15,16),brass);cell.rotation.x=Math.PI/2;cell.position.y=.035;root.add(cell);
    } else {
      part(root,.19,.06,.14,0,.03,0,paper);part(root,.11,.003,.018,0,.062,0,paint);part(root,.018,.003,.08,0,.063,0,paint);
    }
    const t={id,item,type:'pickup',label:'Take '+(ITEMS[item]?.name||item),mesh:root,position:new THREE.Vector3(),container:parent,fixed:true,available:true,enabled:false};
    root.visible=false;interactables.push(t);return t;
  }
  const chest=container('cache_lostProperty','lost-property chest',-18.2,0,-23.3,1.3,.58,.8);
  pickup('secret_serviceKey','serviceKey',chest,[-.3,.04,0]);
  pickup('secret_calm_1','groundingKit',chest,[.2,.04,0]);
  const crate=container('cache_serviceCrate','wooden supply crate',22.8,0,-53.6,1.4,.62,1);
  const toolbox=container('cache_toolbox','locked service toolbox',0,.04,0,1,.34,.7,crate,'serviceKey');
  pickup('secret_cutters','cutters',toolbox,[0,.04,0]);
  pickup('secret_battery','battery',toolbox,[.34,.04,0]);
  pickup('secret_calm_2','groundingKit',toolbox,[-.32,.04,0]);
  pickup('secret_screwdriver','screwdriver',toolbox,[-.21,.11,-.14]);
  pickup('secret_crowbar','crowbar',crate,[.54,.05,0]);
  // A third portable kit is nested in a small first-aid box in reception.
  const aid=container('cache_receptionAid','reception first-aid box',-5.6,.84,5,.52,.22,.38);
  box(-5.6,.4,5,.8,.8,.6,0x494c3e,'desk','lobby',true);
  pickup('reception_calm','groundingKit',aid);
  function grounding(id,x,z,title) {
    const base=box(x,.5,z,1.2,1,.65,0x494c3e,'desk','school',true);
    const card=textPlane('TAKE A BREATH\nName five things you can see.',x,1.03,z,.8,.4,0,'#34433a','#c6b996',27);
    card.rotation.x=-Math.PI/2;
    interactables.push({id,type:'grounding',label:title,mesh:base,position:new THREE.Vector3(x,1,z),enabled:true});
  }
  grounding('ground_reception',-5.6,8,'Rest at the reception grounding card');
  grounding('ground_lostProperty',-18.5,-22,'Rest at the lost-property grounding card');

  // Each physical clue points at the next lock; the journal keeps only what has been found.
  function clue(id,title,body,x,z,roomId) {
    const page=textPlane(title,x,.83,z,.6,.4,0,'#3c3025','#c6b996',26);
    page.rotation.x=-Math.PI/2;
    box(x,.38,z,.85,.76,.65,0x494c3e,'desk',roomId,true);
    interactables.push({id,type:'clue',label:'Read '+title,mesh:page,position:new THREE.Vector3(x,.83,z),
      note:{type:'THE SEALED WING',title,body},enabled:true});
  }
  clue('clue_reception','A missing cupboard',
    'The inventory lists a lost-property cupboard behind Classroom 04. There is no door on the plan. Look for the loose LOST PROPERTY panel on its west wall, near the back corner.',-5.5,3.2,'lobby');
  clue('clue_lost','The caretaker’s key',
    'The brass key in this chest opens the SERVICE panel in east maintenance, opposite the fire-record table. Search the supply crate inside. The small toolbox uses the same key.',-18.5,-24.1,'lostProperty');
  clue('clue_tools','Two different barriers',
    'The screwdriver removes the MAP STORE cover on the office east wall. The crowbar lifts the boards over PROJECTION on the archive west wall. Keep the bolt cutters: the rescue case is chained shut.',24,-51.2,'serviceCache');
  const maps=container('cache_mapCabinet','map cabinet',18.6,0,-23.4,1.2,.62,.8);
  pickup('secret_crank','crank',maps);
  pickup('map_battery','battery',maps,[.36,.05,0]);
  clue('clue_maps','The missing slide',
    'Staff were told to hide the evacuation route in a projection slide. The projector crank was stored in this map cabinet. Take it to the boarded booth behind the archive, and restore school power at the maintenance fuse box. The slide carries the vault access code.',18.7,-20.6,'mapStore');
  // Three-dimensional projector, hand crank socket and a screen visible from the doorway.
  const machine=box(-18.3,1.14,-40.7,.65,.42,.55,0x303b37,'desk','projection');
  box(-18.3,.45,-40.7,1.2,.9,.8,0x494c3e,'desk','projection',true);
  for(const dx of [-.2,.2]){const reel=new THREE.Mesh(new THREE.TorusGeometry(.21,.025,8,24),brass);reel.position.set(-18.3+dx,1.55,-40.7);scene.add(reel);}
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.3,18),brass);lens.rotation.x=Math.PI/2;lens.position.set(-18.3,1.14,-40.28);scene.add(lens);
  const screen=textPlane('EMERGENCY ROUTE\nRESTORE POWER / FIT CRANK',-18,2,-37.15,2.8,1.5,Math.PI,'#646c60','#c5c4ac',24);
  const projected=textPlane('RECORD VAULT: 4 1 7\nSERVICE CACHE → VAULT → EXIT',-18,2,-37.12,2.8,1.5,Math.PI,'#27352e','#ded4ad',29);
  projected.visible=false;
  const projector={id:'puzzle_projector',type:'projector',label:'Fit the crank and project the evacuation slide',mesh:machine,position:machine.position.clone(),enabled:true,projected,screen};
  interactables.push(projector);
  clue('clue_booth','Mrs. Vale’s instructions',
    'A power failure sealed the record vault. The projector slide carries its three-digit code. Inside the vault, bolt cutters open the rescue case. Its red emergency key opens the fire exit. I am going back for Mara. — V.',-18.7,-42.1,'projection');
  const rescue=container('cache_rescueCase','chained rescue case',28.6,0,-53.7,1.25,.6,.85,null,'cutters');
  pickup('secret_rescueKey','rescueKey',rescue,[-.25,.04,0]);
  pickup('vault_calm','groundingKit',rescue,[.24,.04,0]);
  clue('clue_truth','The last evacuation record',
    'The hidden rooms were not a trap. They formed the school’s emergency route: lost property held the service key, the map store kept the crank, and the projector protected the vault code.\n\nMrs. Vale left the tools along this route before returning for Mara. She did not lock Mara in. She died trying to bring her out. The Teacher is still searching because that was her final promise.\n\nThe rescue case holds the red fire-exit key. You can leave with the record, or return to find Mara and finish what Vale started.',28.6,-51.1,'evidenceVault');
  const fire=box(29.84,1.45,-52.35,.12,2.9,1.45,0x5b302c,'trim','evidenceVault');
  const fireBar=box(29.9,1.25,-52.35,.07,.08,.95,0xb99c5c);
  const fireSign=textPlane('FIRE EXIT',29.9,2.5,-52.35,1.05,.32,-Math.PI/2,'#d5d5b5','#31513b',32);
  const exitHinge=new THREE.Group();exitHinge.position.set(30,0,-53.075);scene.add(exitHinge);
  const exitLeaf=new THREE.Mesh(new THREE.BoxGeometry(.14,2.9,1.45),new THREE.MeshStandardMaterial({color:0x5b302c,roughness:.9}));
  exitLeaf.position.set(0,1.45,.725);exitHinge.add(exitLeaf);fire.visible=false;fire.userData.collisionOnly=true;
  scene.updateMatrixWorld(true);exitHinge.attach(fireBar);exitHinge.attach(fireSign);
  const exitCollider=box(30,1.45,-52.35,.14,2.9,1.45,0,null,'outside',true);exitCollider.visible=false;
  const fireExit={id:'secret_fireExit',type:'secretExit',requires:'rescueKey',label:'Unlock the fire exit',mesh:exitHinge,hinge:exitHinge,
    position:new THREE.Vector3(29.9,1.5,-52.35),enabled:true,obstacle:exitCollider.userData.obstacle,
    width:1.45,thickness:.14,rotation:0,baseAxis:{x:0,z:1},amount:0,angle:0,open:false};
  box(30,3.35,-52.35,.23,.9,1.8,0x666d65,'wall','evidenceVault',true);
  exitHinge.userData.obstacle=fireExit.obstacle;
  interactables.push(fireExit);
  panels.fireExit=fireExit;
  grounding('ground_vault',26.4,-54,'Rest at the vault grounding card');
  panels.builders={container,pickup,clue,grounding};
  return panels;
}
export function syncSecrets(world,opened,unlocked=new Set(),notes=new Set()) {
  const projector=world.interactables.find(t=>t.id==='puzzle_projector');
  if(projector){projector.projected.visible=opened.has(projector.id);projector.screen.visible=!projector.projected.visible;}
  for(const p of [...(world.secrets||[]),...(world.secretExit?[world.secretExit]:[])]){
    p.pushable=(opened.has(p.id)||unlocked.has(p.id)) && (p.type!=='secretExit'||notes.has('clue_truth'));p.unlatched=p.pushable;
    p.amount=p.pushable ? (opened.has(p.id)?1:.065) : 0;p.swing=p.position.x<0?1:-1;
    updatePushDoor(p);p.enabled=p.type==='secretExit'||!p.open;
    for(const b of p.barriers||[])b.visible=!p.unlatched;
  }
}
export function animateSecrets(panels,dt){
  for(const p of [...panels,...(panels.fireExit?[panels.fireExit]:[])]){
    updatePushDoor(p);p.enabled=p.type==='secretExit'||!p.open;
    for(const b of p.barriers||[])b.visible=!p.unlatched;
  }
}
