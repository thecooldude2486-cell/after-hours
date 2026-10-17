import {LightCulling} from "./light-culling.js";
import * as THREE from "../../vendor/three.module.js";
import { APPARITION_LAYER } from "../world/distant-figure.js";
/** Optional school lens effects; the live geometry blur always applies to distant apparitions. */
export class SchoolRenderer {
  constructor(renderer, config) {
    this.renderer = renderer;
    this.lightCulling=new LightCulling();
    this.config = config;
    this.supported =
      renderer.extensions?.has?.("EXT_color_buffer_float") !== false;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: this.supported ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
    });
    this.target.depthTexture = new THREE.DepthTexture(
      1,
      1,
      THREE.UnsignedIntType,
    );
    this.target.samples = config.performanceMode==='high'?Math.min(2, renderer.capabilities?.maxSamples ?? 2):0;
    renderer.localClippingEnabled = true;
    this.figureTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
    });
    this.figureTarget.depthTexture = new THREE.DepthTexture(
      1,
      1,
      THREE.UnsignedIntType,
    );
    this.maskMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.uniforms = {
      sceneColor: { value: this.target.texture },
      sceneDepth: { value: this.target.depthTexture },
      size: { value: new THREE.Vector2(1, 1) },
      nearFar: { value: new THREE.Vector2(0.06, 90) },
      friendly: { value: 0 },
      time: { value: 0 },
      figureMask: { value: this.figureTarget.texture },
      figureDepth: { value: this.figureTarget.depthTexture },
      figureActive: { value: 0 },
      figureBlur: { value: 13 },
      lensOnly: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
      fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D sceneColor;uniform sampler2D sceneDepth;
    uniform sampler2D figureMask;uniform sampler2D figureDepth;uniform float figureActive;uniform float figureBlur;uniform float lensOnly;
    uniform vec2 size;uniform vec2 nearFar;uniform float friendly;uniform float time;
    float distanceAt(vec2 p){float d=texture2D(sceneDepth,p).r;return (nearFar.x*nearFar.y)/(nearFar.y-d*(nearFar.y-nearFar.x));}
    float viewDistance(float d){return (nearFar.x*nearFar.y)/(nearFar.y-d*(nearFar.y-nearFar.x));}
    float visibleFigure(vec2 uv){
      float mask=texture2D(figureMask,uv).r;
      float a=viewDistance(texture2D(figureDepth,uv).r),b=distanceAt(uv);
      return mask*step(a,b+.025);
    }
    void main(){
      vec3 color=texture2D(sceneColor,vUv).rgb;
      vec2 texel=1.0/size;
      if(lensOnly<.5){
      float center=distanceAt(vUv),occlusion=0.0;
      for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 p=vUv+vec2(cos(a),sin(a))*texel*(3.0+mod(float(i),2.0)*3.0);float gap=center-distanceAt(p);occlusion+=smoothstep(.025,.16,gap)*(1.0-smoothstep(.3,1.1,gap));}
      color*=1.0-occlusion*.045*(1.0-friendly*.65)*(1.0-lensOnly);
      vec3 bloom=vec3(0.0);
      for(int i=0;i<4;i++){float a=float(i)*1.570796;bloom+=max(vec3(0.0),texture2D(sceneColor,vUv+vec2(cos(a),sin(a))*texel*4.0).rgb-vec3(1.0));}
      color+=bloom*.025*(1.0-lensOnly);
      }
      if(figureActive>.5){
        vec3 softened=vec3(0.0);float footprint=visibleFigure(vUv);
        for(int i=0;i<16;i++){
          float a=float(i)*2.39996,r=sqrt((float(i)+.5)/16.0)*figureBlur;
          vec2 uv=clamp(vUv+vec2(cos(a),sin(a))*texel*r,vec2(.001),vec2(.999));
          softened+=texture2D(sceneColor,uv).rgb/16.0;
          footprint=max(footprint,visibleFigure(uv)*.6);
        }
        color=mix(color,softened,clamp(footprint,0.0,1.0));
      }
      if(lensOnly<.5){
      float grain=fract(sin(dot(vUv*size,vec2(12.9898,78.233))+floor(time*24.0))*43758.5453)-.5;
      color+=grain*.009*(1.0-friendly*.8)*(1.0-lensOnly);
      float vignette=smoothstep(.26,.75,length(vUv-.5));color*=1.0-vignette*.11*(1.0-friendly*.85)*(1.0-lensOnly);
      }
      gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    });
    this.scene = new THREE.Scene();
    this.scene.add(
      new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material),
    );
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  // Render an object-ID/depth mask of the 3D figure, preserving the gameplay camera and scene.
  renderFigureMask(world, camera) {
    const r = this.renderer,
      scene = world.scene;
    const state = {
      layers: camera.layers.mask,
      background: scene.background,
      fog: scene.fog,
      override: scene.overrideMaterial,
      color: r.getClearColor(new THREE.Color()).clone(),
      alpha: r.getClearAlpha(),
    };
    try {
      camera.layers.set(APPARITION_LAYER);
      scene.background = null;
      scene.fog = null;
      scene.overrideMaterial = this.maskMaterial;
      this.maskMaterial.clippingPlanes = world.apparition.clipPlanes;
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(this.figureTarget);
      r.clear();
      r.render(scene, camera);
    } finally {
      camera.layers.mask = state.layers;
      scene.background = state.background;
      scene.fog = state.fog;
      scene.overrideMaterial = state.override;
      r.setClearColor(state.color, state.alpha);
      r.setRenderTarget(this.target);
    }
  }
  render(world, camera, time) {
    this.lightCulling.begin(world,camera);
    try { this.renderFrame(world,camera,time); }
    finally { this.lightCulling.end(); }
  }
  renderFrame(world,camera,time){
    const r = this.renderer;
    const figure = Boolean(world.apparition?.mesh.visible);
    this.uniforms.figureActive.value = figure ? 1 : 0;
    const effects=this.config.screenEffects!==false&&!this.lowPower;
    this.uniforms.lensOnly.value = effects ? 0 : 1;
    if ((!this.supported || !effects) && !figure) {
      r.setRenderTarget(null);
      r.render(world.scene, camera);
      return;
    }
    const dimensions = r.getDrawingBufferSize(new THREE.Vector2());
    if (
      this.target.width !== dimensions.x ||
      this.target.height !== dimensions.y
    ) {
      this.target.setSize(dimensions.x, dimensions.y);
      this.figureTarget.setSize(dimensions.x, dimensions.y);
      this.uniforms.size.value.copy(dimensions);
    }
    this.uniforms.nearFar.value.set(camera.near, camera.far);
    this.uniforms.friendly.value = ["normal", "memory"].includes(
      world.env.state,
    )
      ? 1
      : 0;
    this.uniforms.time.value = time;
    r.setRenderTarget(this.target);
    r.render(world.scene, camera);
    if (figure) {
      this.uniforms.figureBlur.value = world.apparition.blurRadius;
      this.renderFigureMask(world, camera);
    }
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }
}
