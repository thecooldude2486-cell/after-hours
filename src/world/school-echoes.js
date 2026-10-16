import * as T from '../../vendor/three.module.js';
import {ECHO_ROOMS,MARA_PAGES,REPEATED_SENTENCE} from '../data/echoes.js';
import {createEchoModel} from './echo-models.js';
import {ageNote} from './aged-paper.js';
import {blocked} from '../systems/navigation.js';

export function drawEchoBoard(entry,progress=0){
  const g=entry.canvas.getContext('2d');
  g.fillStyle='#18302b';g.fillRect(0,0,1024,640);
  g.fillStyle='#b4b4a00d';
  for(let i=0;i<18;i++)g.fillRect((i*149)%980,(i*87)%590,150,13);
  g.font='27px Georgia';g.textAlign='left';
  for(let row=0;row<9;row++){
    g.fillStyle=row%3===0?'#9d6053':'#ab9c84';
    g.fillText(REPEATED_SENTENCE+'  '+REPEATED_SENTENCE,34,53+row*59,952);
  }
  g.fillStyle='#d3c7a1';g.fillText(REPEATED_SENTENCE.slice(0,Math.floor(progress*REPEATED_SENTENCE.length)),34,605,950);
  entry.texture.needsUpdate=true;
}

export function addSchoolEchoes({scene,box,textPlane,interactables,builders,obstacles}){
  const rooms=ECHO_ROOMS.map((r,index)=>{
    const group=new T.Group();group.name='Unfinished lesson / '+r.id;group.visible=false;scene.add(group);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const width=r.boardWidth??Math.min(4.7,r.w-1.2),boardZ=r.boardZ??r.z-r.d/2+.16;
    const boardX=r.boardX??r.x,yaw=r.boardYaw||0,nx=Math.sin(yaw),nz=Math.cos(yaw);
    const board=new T.Mesh(new T.PlaneGeometry(width,1.7),new T.MeshStandardMaterial({map:texture,roughness:1}));
    board.position.set(boardX+nx*.035,2.05,boardZ+nz*.035);board.rotation.y=yaw;group.add(board);
    const frame=new T.Mesh(new T.BoxGeometry(width+.12,1.82,.045),new T.MeshStandardMaterial({color:0x514939}));
    frame.position.set(boardX,2.05,boardZ);frame.rotation.y=yaw;group.add(frame);
    const teacher=createEchoModel('teacher',index);teacher.position.set(boardX-width*.34*nz+nx*.48,0,boardZ+width*.34*nx+nz*.48);teacher.rotation.y=yaw;group.add(teacher);
    const chalk=new T.Mesh(new T.CylinderGeometry(.008,.008,.06,6),new T.MeshStandardMaterial({color:0xd5c6a1}));
    chalk.position.set(0,-.68,0);teacher.userData.arms[1].add(chalk);
    const students=[];
    for(let i=0;i<r.count;i++){
      const pupil=createEchoModel('student',index*7+i);
      pupil.rotation.y=yaw;
      // Side aisles preserve the central route and all original desk interactions.
      const side=i%2?-1:1;
      const x=r.x+side*Math.min(r.w/2-.65,r.w>10?3.7:1.3);
      const z=r.z+Math.floor(i/2)*1.65-Math.min(1.5,r.d*.1);
      pupil.position.set(x,0,T.MathUtils.clamp(z,r.z-r.d/2+.7,r.z+r.d/2-.7));
      pupil.userData.home=pupil.position.clone();group.add(pupil);students.push(pupil);
    }
    const glow=new T.PointLight(0xff8042,.22,5,2);glow.position.set(r.x,1.3,r.z);group.add(glow);
    const entry={...r,index,group,teacher,students,board,canvas,texture,glow,entered:false,elapsed:0,boardTime:0};
    drawEchoBoard(entry);return entry;
  });
  const headmaster=createEchoModel('headmaster');headmaster.position.set(6.4,0,-18.5);scene.add(headmaster);
  const eli=createEchoModel('eli');scene.add(eli);
  const {container,pickup}=builders;
  const tin=container('mara_pencilTin','Mara’s pencil tin',-12.5,.84,-15.5,.42,.16,.28,null,'lockerKey');
  box(-12.5,.4,-15.5,.75,.8,.6,0x494c3e,'desk','classroom',true);
  pickup('mara_diaryKey','diaryKey',tin);
  const book=interactables.find(t=>t.id==='annex_hollowBook');
  const clapper=pickup('library_bellClapper','bellClapper',book,[.17,.04,.09]);
  // Give the bell part its own recognizable metal pendulum model.
  clapper.mesh.clear();
  const brass=new T.MeshStandardMaterial({color:0xaa8a50,metalness:.65,roughness:.5});
  const rod=new T.Mesh(new T.CylinderGeometry(.012,.012,.19,10),brass);rod.rotation.z=Math.PI/2;clapper.mesh.add(rod);
  const weight=new T.Mesh(new T.SphereGeometry(.038,12,8),brass);weight.position.x=.09;clapper.mesh.add(weight);
  const folder=container('archive_sealCase','staff seal case',-12.7,.86,-36,.55,.2,.4,null,'recordsKey');
  box(-12.7,.4,-36,.8,.8,.65,0x494c3e,'desk','archive',true);
  pickup('archive_headmasterKey','headmasterKey',folder);
  const aid=container('library_ashAid','library first-aid tin',-32.4,.83,-35.2,.42,.2,.3);
  box(-32.4,.4,-35.2,.8,.8,.6,0x494c3e,'desk','library',true);
  pickup('library_storyCalm','groundingKit',aid);

  function page(id,x,z,room){
    const note=MARA_PAGES[id],mesh=textPlane(note.title,x,.85,z,.62,.42,0,'#382d24','#c8b58c',25);
    ageNote(mesh,note.title,id.length);mesh.rotation.x=-Math.PI/2;
    box(x,.4,z,.85,.8,.65,0x494c3e,'desk',room,true);
    const t={id,type:'clue',label:'Read Mara’s journal page',mesh,position:new T.Vector3(x,.85,z),note,enabled:true};
    interactables.push(t);return t;
  }
  page('mara_page_2',-13,-18,'classroom');
  page('mara_page_3',5.1,-34,'phone');
  page('mara_page_4',-34,-36.5,'library');
  box(12.5,.4,-15.5,1.65,.8,1,0x494c3e,'desk','office',true);
  const file=box(12.5,.89,-15.5,.72,.18,.5,0x353d3b,'desk','office');
  const lid=new T.Group();lid.position.set(12.5,.99,-15.75);scene.add(lid);
  const cover=new T.Mesh(new T.BoxGeometry(.72,.035,.5),new T.MeshStandardMaterial({color:0x303c36}));cover.position.z=.25;lid.add(cover);
  const label=textPlane('HEADMASTER\nCONFIDENTIAL',12.5,1.015,-15.5,.58,.3,0,'#272b24','#b9aa82',24);label.rotation.x=-Math.PI/2;scene.updateMatrixWorld(true);lid.attach(label);
  const headmasterFile={id:'headmaster_file',type:'evidence',label:'Examine the headmaster’s sealed file',mesh:file,position:file.position.clone(),requires:'headmasterKey',note:MARA_PAGES.headmaster_file,lid,amount:0,enabled:true,reward:'attendanceRoll'};
  const roll=textPlane('CLASS 08\nDEPARTURES',12.5,.99,-15.5,.54,.34,0,'#302d24','#b8ae8f',23);roll.rotation.x=-Math.PI/2;
  interactables.push(headmasterFile);
  const registerMesh=textPlane('CLASS 08\nATTENDANCE',6.1,.85,-43.2,.64,.43,0,'#382d24','#c8b58c',24);
  ageNote(registerMesh,'CLASS 08',8);registerMesh.rotation.x=-Math.PI/2;
  box(6.1,.4,-43.2,.9,.8,.7,0x494c3e,'desk','phone',true);
  const register={id:'ash_register',type:'evidence',label:'Compare the attendance roll',mesh:registerMesh,position:registerMesh.position.clone(),requires:'attendanceRoll',note:MARA_PAGES.ash_register,enabled:true};interactables.push(register);
  // The absent bell piece is visibly fitted when used; the bell really swings.
  const bell=new T.Group();bell.position.set(4.1,1.15,-14.3);scene.add(bell);
  const bellBody=new T.Mesh(new T.CylinderGeometry(.06,.14,.18,20,1,true),brass);bell.add(bellBody);
  const bellFoot=new T.Mesh(new T.CylinderGeometry(.18,.18,.035,20),brass);bellFoot.position.y=-.12;bell.add(bellFoot);
  const bellTarget={id:'headmaster_bell',type:'schoolBell',label:'Ring the office bell',mesh:bell,position:bell.position.clone(),requires:'bellClapper',elapsed:0,enabled:true};interactables.push(bellTarget);
  box(4.1,.52,-14.3,.65,1.04,.5,0x494c3e,'desk','office',true);
  const clapperVisual=new T.Mesh(new T.SphereGeometry(.033,10,8),brass);clapperVisual.position.y=-.06;clapperVisual.visible=false;bell.add(clapperVisual);
  const waiting=interactables.find(t=>t.id==='waiting');waiting.requires='diaryKey';
  for(const r of rooms){
    const t=r.teacher;if(!blocked(t.position.x,t.position.z,obstacles,.15))continue;
    const yaw=r.boardYaw||0,nx=Math.sin(yaw),nz=Math.cos(yaw),width=r.board.geometry.parameters.width;
    const bx=r.boardX??r.x,bz=r.boardZ??r.z-r.d/2+.16;
    for(const fraction of [-.15,0,.15,.34]){
      const x=bx+width*fraction*nz+nx*.48,z=bz-width*fraction*nx+nz*.48;
      if(blocked(x,z,obstacles,.15))continue;
      t.position.set(x,0,z);break;
    }
  }
  // Avoid desks, shelving and the new evidence tables rather than spawning through them.
  for(const r of rooms)for(const pupil of r.students){
    if(!blocked(pupil.position.x,pupil.position.z,obstacles,.2))continue;
    const home=pupil.position.clone();let found=false;
    for(const radius of [.45,.8,1.2,1.8,2.5]){
      for(let i=0;i<16;i++){
        const x=home.x+Math.cos(i*Math.PI/8)*radius,z=home.z+Math.sin(i*Math.PI/8)*radius;
        if(Math.abs(x-r.x)>r.w/2-.55||Math.abs(z-r.z)>r.d/2-.55||blocked(x,z,obstacles,.2))continue;
        pupil.position.set(x,0,z);found=true;break;
      }
      if(found)break;
    }
    pupil.userData.home.copy(pupil.position);
  }
  return {rooms,headmaster,eli,headmasterFile,register,bell:bellTarget,clapperVisual,
    sync(inventory){
      headmasterFile.open=inventory.notes.has(headmasterFile.id);
      if(headmasterFile.open)headmasterFile.lid.rotation.x=-1.2;
      clapperVisual.visible=inventory.opened.has('headmaster_bell');
    },
    animate(dt){
      if(headmasterFile.open){headmasterFile.amount=Math.min(1,headmasterFile.amount+dt*1.5);headmasterFile.lid.rotation.x=-headmasterFile.amount*1.2;}
      else{headmasterFile.amount=0;headmasterFile.lid.rotation.x=0;}
      bellTarget.elapsed=Math.max(0,bellTarget.elapsed-dt);
      bell.rotation.z=Math.sin(bellTarget.elapsed*28)*Math.min(.35,bellTarget.elapsed*.22);
    },
  };
}
