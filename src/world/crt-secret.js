import * as THREE from '../../vendor/three.module.js';

/** An optional, persistent service-channel puzzle and a physical supply latch. */
export function addCRTSecret({scene,box,textPlane,interactables,crt,builders}) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const selector=box(5.30,1.21,-20.665,.095,.075,.055,0x252f29);
  const slot=box(5.30,1.21,-20.63,.012,.042,.008,0x080e0b);
  textPlane('SERVICE',5.30,1.15,-20.625,.22,.055,0,'#c6c5a8','#252f29',40);
  const key=new THREE.Mesh(new THREE.TorusGeometry(.025,.006,8,16),new THREE.MeshStandardMaterial({color:0x949b88,metalness:.7,roughness:.4}));
  key.position.set(5.30,1.21,-20.60);key.visible=false;scene.add(key);
  const target={id:'crt_service',type:'crtService',label:'Turn the CRT service selector',mesh:selector,
    position:selector.position.clone(),enabled:true,note:{type:'CRT SERVICE FEED',title:'Record vault · 4 1 7',
      body:'The service channel shows RECORD VAULT: 417. The electronic latch beneath the office desk releases the supply case. The vault keypad still needs maintenance power.'}};
  interactables.push(target);
  const cache=builders.container('cache_crt','concealed monitor supply case',5,.25,-21,.9,.32,.58);
  cache.crtLocked=true;
  builders.pickup('crt_crowbar','crowbar',cache,[-.2,.04,0]);
  builders.pickup('crt_calm','groundingKit',cache,[.23,.04,0]);
  let mode='off',inventory=null,turn=0;
  function sync(inv) {
    inventory=inv;
    const released=inv.unlocked.has(target.id);
    mode=!crt.open?'off':released?'secret':inv.power?'ready':'static';
    cache.crtLocked=!released;
    cache.open=released && inv.opened.has(cache.id);
    const active=mode!=='off';
    if(crt.screen.material.map!==(active?texture:null)){
      crt.screen.material.map=active?texture:null;
      crt.screen.material.emissiveMap=active?texture:null;
      crt.screen.material.needsUpdate=true;
    }
    if(active)crt.screen.material.color.setHex(0xffffff);
    key.visible=released;
    target.label=released?'Service channel selected':'Turn the CRT service selector';
    return mode;
  }
  function update(dt,time) {
    if(inventory && mode!=='off')sync(inventory);
    turn=THREE.MathUtils.damp(turn,inventory?.unlocked.has(target.id)?Math.PI/2:0,5,dt);
    key.rotation.z=turn;slot.rotation.z=turn;
    if(mode==='off')return;
    // A legible monochrome feed, with restrained scan lines rather than a flash.
    context.fillStyle='#07150e';context.fillRect(0,0,512,256);
    context.fillStyle='#a1d9ac';context.textAlign='center';
    context.font='bold 23px monospace';context.fillText('SCHOOL / SERVICE CHANNEL',256,42);
    if(mode==='secret'){
      context.font='24px monospace';context.fillText('RECORD VAULT',256,94);
      context.font='bold 60px monospace';context.fillText('4 1 7',256,160);
      context.font='19px monospace';context.fillText('DESK LATCH RELEASED',256,213);
    }else{
      context.font='bold 27px monospace';context.fillText(mode==='ready'?'SERVICE SELECTOR LOCKED':'NO MAINTENANCE SIGNAL',256,124);
      context.font='19px monospace';context.fillText(mode==='ready'?'SERVICE KEY REQUIRED':'RESTORE FUSE BOX POWER',256,175);
    }
    context.fillStyle='#00000028';for(let y=Math.floor(time*7)%4;y<256;y+=4)context.fillRect(0,y,512,1);
    texture.needsUpdate=true;
  }
  return {target,cache,texture,key,sync,update,get mode(){return mode;}};
}
