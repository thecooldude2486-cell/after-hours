import * as T from '../../vendor/three.module.js';
import {ELI_ROOMS} from '../data/echoes.js';
import {animateShadow} from '../world/shadow-figure.js';
import {animateEcho} from '../world/echo-models.js';
import {drawEchoBoard} from '../world/school-echoes.js';
import {Navigation,slide,lineClear} from './navigation.js';

const inside=(p,r,pad=0)=>Math.abs(p.x-r.x)<r.w/2-pad&&Math.abs(p.z-r.z)<r.d/2-pad;
const eye=p=>new T.Vector3(p.x,1.5,p.z);
const turn=(a,b,dt,speed=3)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*(1-Math.exp(-dt*speed));
/** The unfinished lessons and Eli belong to present-day exploration, never to the warm memories. */
export class EchoSystem{
  constructor(game){
    this.game=game;this.world=game.world.echoes;this.nav=new Navigation(game.world.obstacles);
    this.sightObstacles=game.world.obstacles.filter(o=>(o.maxY??4)>1.45&&(o.minY??0)<1.75);
    this.reset();
  }
  reset(save={}){
    this.seen=new Set(save.revision===34?save.seen||[]:[]);this.eliActive=false;this.eliElapsed=0;this.eliStage=null;
    this.distraction=0;this.headmasterActive=false;this.headmasterContact=0;this.headmasterStep=0;this.chalk=0;
    this.headmasterTarget=0;this.path=[];this.pathTimer=0;this.damageRate=0;
    if(!this.world)return;
    for(const r of this.world.rooms){
      r.group.visible=false;r.entered=false;r.elapsed=0;
      for(const s of r.students){s.position.copy(s.userData.home);s.rotation.y=r.boardYaw||0;s.userData.head.rotation.y=0;}
    }
    this.world.eli.visible=false;this.world.headmaster.visible=false;
    this.world.headmaster.position.set(6.4,0,-18.5);
  }
  snapshot(){return {revision:34,seen:[...this.seen]};}
  eligible(){
    const g=this.game;
    return g.started!==false&&!g.paused&&!g.ended&&!g.recovering&&!g.interactions.reader&&
      !g.cinematics.active&&!g.dialogue.current&&!g.story.triggers.busy&&!g.story.companion&&
      !g.ambushes?.blocking&&!['normal','memory'].includes(g.world.env.state)&&
      ['locker','drawing','cassette','survive','phone','afternoon','fault','vale','headmaster','emptyClass','waiting'].includes(g.story.stage);
  }
  ringBell(){
    this.distraction=16;this.pathTimer=0;this.path=[];
    this.world.bell.elapsed=2.4;this.world.clapperVisual.visible=true;
    this.game.audio.cue('headmasterBell',this.world.bell.position);
    this.game.inventory.opened.add('headmaster_bell');this.game.story.save?.();
  }
  blocksReading(){
    const g=this.game,h=this.world?.headmaster;
    if(!h?.visible||!this.headmasterActive||this.distraction>0||g.cheats?.invincible||g.cheats?.disableMonsters)return false;
    const p=g.player.position,dx=p.x-h.position.x,dz=p.z-h.position.z,d=Math.hypot(dx,dz);
    return d<5.3&&(-Math.sin(h.rotation.y)*dx-Math.cos(h.rotation.y)*dz)/Math.max(.1,d)>.2&&lineClear(eye(h.position),p,this.sightObstacles);
  }
  update(dt,time){
    if(!this.world)return;
    const g=this.game,w=this.world,p=g.player.position;
    this.damageRate=0;
    if(g.paused||g.interactions.reader)return;
    w.animate(dt);
    if(!this.eligible()){
      for(const r of w.rooms)r.group.visible=false;
      w.headmaster.visible=false;w.eli.visible=false;
      this.headmasterActive=false;this.eliActive=false;return;
    }
    let current=null;
    for(const r of w.rooms){
      const state=g.world.env.roomStates.get(r.id)||g.world.env.state;
      const friendly=['normal','memory'].includes(state);
      const near=Math.hypot(p.x-r.x,p.z-r.z)<Math.max(r.w,r.d)/2+12;
      const entered=inside(p,r,.1);
      r.group.visible=near&&!friendly&&(entered||lineClear(p,{x:r.x,y:1.5,z:r.z},this.sightObstacles));
      if(!r.group.visible)continue;
      r.teacher.visible=true;r.elapsed+=dt;
      animateEcho(r.teacher,dt,time,{writing:true});
      if(entered){
        r.boardTime+=dt;
        if(r.boardTime>.14){drawEchoBoard(r,(time*.11+r.index*.17)%1);r.boardTime=0;}
      }
      if(entered){
        current=r;
        if(!r.entered){r.entered=true;r.elapsed=0;g.audio.cue('ashTurn',r.students[0]?.position);}
      }else if(r.entered){r.entered=false;r.elapsed=0;}
      for(const s of r.students){
        s.visible=true;
        // Bodies stay fixed in the unfinished lesson; only their heads follow a visible visitor.
        animateEcho(s,dt,time,{moving:false,gaze:entered&&!g.player.hidden?p:null});
      }
    }
    this.chalk-=dt;
    if(current&&this.chalk<=0){
      g.audio.cue('chalkWrite',current.teacher.position);
      if(current.elapsed>2)g.audio.cue('ashEmbers',current.students[0]?.position);
      this.chalk=2.8;
    }
    // One capped drain for the whole class, independent of the number of pupils.
    this.damageRate=current&&!g.player.hidden ? .16 : 0;
    if(g.cheats?.infiniteSanity||g.cheats?.disableMonsters)this.damageRate=0;
    if(this.damageRate)g.player.sanity=Math.max(0,g.player.sanity-this.damageRate*dt);
    this.updateHeadmaster(dt,time);
    this.updateEli(dt,time);
  }
  updateHeadmaster(dt,time){
    const g=this.game,h=this.world.headmaster,p=g.player.position;
    this.headmasterActive=g.story.stage==='headmaster';
    h.visible=this.headmasterActive;
    if(!h.visible)return;
    this.distraction=Math.max(0,this.distraction-dt);
    this.headmasterContact=Math.max(0,this.headmasterContact-dt);
    const route=[{x:6.4,z:-18.5},{x:12.4,z:-20},{x:9.2,z:-14.1}];
    const target=this.distraction>0?{x:4.7,z:-14.5}:route[this.headmasterTarget];
    this.pathTimer-=dt;
    if(this.pathTimer<=0){this.path=this.nav.path(h.position,target);this.pathTimer=1;}
    let point=this.path[0];
    if(point&&Math.hypot(point.x-h.position.x,point.z-h.position.z)<.2){this.path.shift();point=this.path[0];}
    const moving=!!point;
    if(point){
      const dx=point.x-h.position.x,dz=point.z-h.position.z,d=Math.hypot(dx,dz),amount=Math.min(d,dt*.75);
      slide(h.position,dx/Math.max(.01,d)*amount,dz/Math.max(.01,d)*amount,g.world.obstacles,.24);
      h.rotation.y=turn(h.rotation.y,Math.atan2(-dx,-dz),dt,1.6);
    }else if(!this.distraction)this.headmasterTarget=(this.headmasterTarget+1)%route.length;
    this.headmasterStep-=dt;
    if(moving&&this.headmasterStep<=0){g.audio.cue('headmasterStep',h.position);this.headmasterStep=.95;}
    animateEcho(h,dt,time,{moving,gaze:this.blocksReading()?p:null});
    if(this.blocksReading()&&h.position.distanceTo(p)<2&&this.headmasterContact<=0){
      if(!g.cheats?.infiniteSanity)g.player.sanity=Math.max(0,g.player.sanity-4);
      g.audio.cue('headmasterThreat',h.position);this.headmasterContact=5;
    }
  }
  updateEli(dt,time){
    const g=this.game,e=this.world.eli,spot=ELI_ROOMS[g.story.stage];
    e.visible=false;
    if(!spot){this.eliActive=false;return;}
    if(this.eliStage!==g.story.stage){
      this.eliStage=g.story.stage;this.eliElapsed=0;this.eliActive=false;e.scale.setScalar(1);
      e.position.set(spot.position[0],0,spot.position[1]);this.eliOrigin=e.position.clone();
    }
    if(this.seen.has(g.story.stage))return;
    const room=this.world.rooms.find(r=>r.id===spot.room),state=g.world.env.roomStates.get(room.id)||g.world.env.state;
    if(['normal','memory'].includes(state))return;
    const p=g.player.position,d=Math.hypot(p.x-this.eliOrigin.x,p.z-this.eliOrigin.z);
    if(!this.eliActive){
      if(g.hauntings?.active||!inside(p,room)||d<1.6||d>14||!lineClear(p,eye(this.eliOrigin),this.sightObstacles))return;
      const facing=g.camera?g.camera.getWorldDirection(new T.Vector3()).dot(eye(this.eliOrigin).sub(g.camera.position).normalize())>.72:true;
      if(!facing)return;
      this.eliActive=true;this.eliElapsed=0;g.audio.cue('eliEcho',e.position);
    }
    this.eliElapsed+=dt;
    if(this.eliElapsed>=.58){
      this.seen.add(g.story.stage);this.eliActive=false;e.visible=false;g.story.save?.();return;
    }
    e.visible=true;
    const amount=Math.sin(Math.min(1,this.eliElapsed/.22)*Math.PI/2);
    const toward=new T.Vector3(p.x-this.eliOrigin.x,0,p.z-this.eliOrigin.z).normalize();
    const lunge=Math.min(.65,Math.max(0,d-1.5))*amount;
    e.position.copy(this.eliOrigin).addScaledVector(toward,lunge);
    e.rotation.set(-.1*amount,Math.atan2(-(p.x-e.position.x),-(p.z-e.position.z)),Math.sin(this.eliElapsed*37)*.09);
    e.scale.set(1+amount*.17,1+amount*.08,1);
    animateShadow(e,time,amount);
  }
}
