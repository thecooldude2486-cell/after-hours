const MODES=new Set(['auto','low','high']);
/** Change GPU work only; frame sampling never changes movement, AI, stamina or story timing. */
export class AdaptivePerformance{
  constructor(renderer,presentation,config,dpr=globalThis.devicePixelRatio||1){
    this.renderer=renderer;this.presentation=presentation;this.config=config;this.dpr=dpr;
    this.mode=null;this.ratio=1;this.lowPower=false;this.resetWindow();this.configure();
  }
  resetWindow(){this.seconds=0;this.frames=0;this.fastSeconds=0;this.warmup=.8;}
  configure(){
    const mode=MODES.has(this.config.performanceMode)?this.config.performanceMode:'auto';
    if(mode===this.mode)return;
    this.mode=mode;this.resetWindow();
    this.maximum=Math.max(.55,Math.min(this.dpr,Number(this.config.pixelRatio)||1.4));
    this.lowPower=mode==='low';
    this.setRatio(mode==='high'?this.maximum:Math.min(this.maximum,mode==='low'?.7:1));
    this.presentation.lowPower=this.lowPower;
    const samples=mode==='high'?Math.min(2,this.renderer.capabilities?.maxSamples??2):0;
    if(this.presentation.target.samples!==samples){this.presentation.target.samples=samples;this.presentation.target.dispose();}
  }
  setRatio(value){
    const next=Math.round(value*100)/100;
    if(this.appliedRatio!==next){this.renderer.setPixelRatio(next);this.appliedRatio=next;}
    this.ratio=next;
  }
  update(seconds,active){
    this.configure();
    if(!active||!Number.isFinite(seconds)||seconds<=0||seconds>.25){this.resetWindow();return;}
    if(this.mode!=='auto')return;
    if(this.warmup>0){this.warmup-=seconds;return;}
    this.seconds+=seconds;this.frames++;
    if(this.seconds<1.2||this.frames<12)return;
    const average=this.seconds/this.frames;
    if(average>1/44){
      this.lowPower=true;this.presentation.lowPower=true;
      this.setRatio(Math.max(Math.min(.55,this.maximum),this.ratio-.12));this.fastSeconds=0;
    }else if(average<1/57){
      this.fastSeconds+=this.seconds;
      if(this.fastSeconds>6){
        this.setRatio(Math.min(this.maximum,1.2,this.ratio+.08));
        // Restore optional lens effects only after the native-sized scene is stable again.
        if(this.ratio>=Math.min(1,this.maximum)){this.lowPower=false;this.presentation.lowPower=false;}
        this.fastSeconds=0;
      }
    }else this.fastSeconds=0;
    this.seconds=0;this.frames=0;
  }
}
