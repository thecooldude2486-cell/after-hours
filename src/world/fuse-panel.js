import * as T from '../../vendor/three.module.js';
export function createFusePanel(scene){
  const root=new T.Group();root.position.set(19.26,1.08,-50);root.rotation.y=-Math.PI/2;scene.add(root);
  const steel=new T.MeshStandardMaterial({color:0x657065,metalness:.45,roughness:.7});
  const dark=new T.MeshStandardMaterial({color:0x1d2926,roughness:.85});
  const ceramic=new T.MeshStandardMaterial({color:0xc8c3ac,roughness:.77});
  const part=(w,h,d,x,y,z,mat=steel,parent=root)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;};
  part(.6,.82,.05,0,.41,-.06,dark);
  for(const x of [-.3,.3])part(.025,.85,.15,x,.41,0);
  for(const y of [0,.83])part(.62,.025,.15,0,y,0);
  const fuses=[];
  for(const x of [-.17,0,.17]){
    const f=new T.Mesh(new T.CylinderGeometry(.038,.038,.18,16),ceramic);f.position.set(x,.52,.015);root.add(f);fuses.push(f);
    for(const y of [.41,.63])part(.085,.03,.07,x,y,.015);
  }
  const lever=new T.Group();lever.position.set(.17,.19,.04);root.add(lever);
  part(.06,.17,.055,0,0,.035,dark,lever);
  const indicator=new T.Mesh(new T.SphereGeometry(.023,10,8),new T.MeshStandardMaterial({color:0x77352c,emissive:0xbd4b31,emissiveIntensity:.5}));indicator.position.set(-.19,.18,.04);root.add(indicator);
  const lid=new T.Group();lid.position.set(-.3,0,.085);root.add(lid);part(.6,.82,.025,.3,.41,0,steel,lid);
  part(.025,.14,.04,.53,.4,.035,dark,lid);
  let repaired=0,open=0;
  return {root,lid,lever,fuses,indicator,repair(){repaired=3;},
    update(dt,failed,powered){
      repaired=Math.max(0,repaired-dt);open+=(Number(failed||repaired>0)-open)*(1-Math.exp(-dt*4));lid.rotation.y=-open*1.5;
      fuses[1].visible=!failed;lever.rotation.z+=(Number(powered)*.8-lever.rotation.z)*(1-Math.exp(-dt*3));
      indicator.material.color.setHex(powered?0x487b51:0x77352c);indicator.material.emissive.setHex(powered?0x4aa35d:0xbd4b31);
    }
  };
}
