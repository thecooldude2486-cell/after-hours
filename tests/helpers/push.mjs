import {PlayerPhysics} from '../../src/systems/physics.js';
/** Exercise real body contact through a secret doorway, rather than setting its open flag. */
export function pushThrough(g,door){
 const p=g.player,side=door.position.x<0?1:-1;
 p.world=g.world;p.config=g.config;p.audio=g.audio;
 p.position.set(door.position.x+side*1.05,1.65,door.position.z);
 const physics=new PlayerPhysics(p);
 for(let i=0;i<240;i++){
  physics.update(1/60,-side*2.35/60,0,false);
  g.world.update(1/60,i/60,p);
  if(side===1?p.position.x<door.position.x-1.9:p.position.x>door.position.x+1.9)break;
 }
 g.inventory.syncStorage();g.world.scene.updateMatrixWorld(true);
 return p.position.clone();
}
