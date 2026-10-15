import * as THREE from "../../vendor/three.module.js";
import { APPARITION_TUNING as STYLE } from "../data/hauntings.js";
export const APPARITION_LAYER = 2;
/** A clipped, volumetric human outline. No image map, plane, sprite or captured billboard. */
export class DistantFigure {
  constructor(scene) {
    this.mesh = new THREE.Group();
    this.mesh.name = "Half-hidden three-dimensional apparition";
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x68716a,
      emissive: 0x879589,
      emissiveIntensity: 0.45,
      roughness: 1,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
    });
    const oval = (p, s) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 24),
        this.material,
      );
      m.position.fromArray(p);
      m.scale.fromArray(s);
      this.mesh.add(m);
      return m;
    };
    this.head = oval([0, 1.76, 0.005], [0.12, 0.15, 0.105]);
    this.torso = oval([0, 1.22, 0], [0.19, 0.36, 0.095]);
    oval([0, 0.82, 0], [0.16, 0.19, 0.09]);
    for (const side of [-1, 1]) {
      oval([side * 0.17, 1.29, 0], [0.057, 0.19, 0.066]);
      oval([side * 0.19, 0.99, 0.01], [0.037, 0.2, 0.039]);
      oval([side * 0.077, 0.46, 0], [0.052, 0.37, 0.048]);
      oval([side * 0.077, 0.06, 0.028], [0.065, 0.04, 0.095]);
    }
    // A readable clothed figure: pale face, recessed eyes and an uneven coat hem.
    this.material.color.setHex(0xa7ada2);
    this.material.emissive.setHex(0x8d9c91);
    this.coatMaterial = this.material.clone();
    this.coatMaterial.color.setHex(0x182322);
    this.coatMaterial.emissive.setHex(0x53645c);
    this.coatMaterial.emissiveIntensity = 0.16;
    this.darkMaterial = this.material.clone();
    this.darkMaterial.color.setHex(0x020303);
    this.darkMaterial.emissive.setHex(0x020303);
    this.materials = [this.material, this.coatMaterial, this.darkMaterial];
    // Dress the torso/limbs; exposed head and hands retain the pale skin material.
    for (const part of this.mesh.children) if (part !== this.head) part.material = this.coatMaterial;
    this.torso.geometry.dispose();
    this.torso.scale.set(1, 0.36, 0.5);
    this.torso.geometry = new THREE.LatheGeometry([
      new THREE.Vector2(0.17, -1), new THREE.Vector2(0.22, -0.85),
      new THREE.Vector2(0.19, 0.4), new THREE.Vector2(0.23, 0.75),
      new THREE.Vector2(0.11, 1),
    ], 36);
    const detail = (name, at, scale, material) => {
      const part = oval(at, scale);
      part.name = name;
      part.material = material;
      return part;
    };
    this.head.name = "Pale apparition face";
    detail("Exposed neck", [0, 1.59, 0], [0.05, 0.09, 0.05], this.material);
    for (const side of [-1, 1]) {
      detail("Recessed eye socket", [side * 0.044, 1.802, 0.099], [0.029, 0.025, 0.016], this.darkMaterial);
      detail("Sunken cheek", [side * 0.067, 1.725, 0.085], [0.025, 0.038, 0.016], this.coatMaterial);
      detail("Drooping shoulder", [side * 0.18, 1.44, 0], [0.085, 0.12, 0.09], this.coatMaterial);
      detail("Long hanging hand", [side * 0.19, 0.77, 0.025], [0.043, 0.095, 0.028], this.material);
      for (let i = 0; i < 4; i++)
        detail("Hanging finger", [side * 0.19 + (i - 1.5) * 0.019, 0.67 - (i % 2) * 0.016, 0.035], [0.008, 0.064, 0.01], this.material);
      for (let i = 0; i < 3; i++)
        detail("Uneven coat hem", [side * (0.06 + i * 0.05), 0.88 - i * 0.017, 0.06], [0.045, 0.14, 0.055], this.coatMaterial);
    }
    detail("Nose ridge", [0, 1.761, 0.111], [0.014, 0.029, 0.017], this.material);
    detail("Hollow mouth", [0, 1.708, 0.1], [0.029, 0.028, 0.014], this.darkMaterial);
    for (const y of [1.08, 1.2, 1.32])
      detail("Coat button", [0, y, 0.071], [0.009, 0.009, 0.008], this.material);
    // Sculpt the face in the actual mesh: pinched temples, indented sockets and a narrow jaw.
    const vertices = this.head.geometry.attributes.position;
    for (let i=0;i<vertices.count;i++) {
      const x=vertices.getX(i), y=vertices.getY(i), z=vertices.getZ(i);
      const front=Math.max(0,z), eye=(side)=>Math.exp(-((x-side*.37)**2/.055+(y-.28)**2/.04));
      const sockets=eye(-1)+eye(1);
      const jaw=y<-.12 ? 1-.19*Math.min(1,(-y-.12)/.8) : 1;
      const brow=Math.exp(-((y-.49)**2/.025))*front*.055;
      vertices.setXYZ(i,x*jaw,y,z-front*.22*sockets+brow);
    }
    vertices.needsUpdate=true;
    this.head.geometry.computeVertexNormals();
    this.material.color.setHex(0xc4c1ae);
    this.material.emissive.setHex(0x626d60);
    this.material.emissiveIntensity=.26;
    this.coatMaterial.color.setHex(0x17211e);
    this.coatMaterial.emissiveIntensity=.1;
    const hair=this.coatMaterial.clone();hair.color.setHex(0x0b100e);hair.emissiveIntensity=.055;
    const scorch=this.darkMaterial.clone();scorch.color.setHex(0x333028);scorch.roughness=1;
    this.materials.push(hair,scorch);
    const tube=(name,points,radius,mat)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const m=new THREE.Mesh(new THREE.TubeGeometry(curve,12,radius,5,false),mat);
      m.name=name;this.mesh.add(m);return m;
    };
    // Matted hair follows the skull, leaving the doorway-facing side of the mask exposed.
    for(let i=0;i<15;i++) {
      const a=(i/14)*Math.PI*1.65-.8,side=Math.cos(a);
      tube("Matted hair strand",[
        [side*.068,1.895,Math.sin(a)*.06-.015],
        [side*.119,1.84,Math.sin(a)*.10-.018],
        [side*.128,1.72,Math.sin(a)*.10-.033],
        [side*.117,1.58-(i%4)*.026,Math.sin(a)*.09-.026]
      ],.008+(i%3)*.002,hair);
    }
    for(const side of [-1,1]) {
      detail("Raised orbital ridge",[side*.043,1.832,.094],[.038,.012,.016],this.material);
      detail("Clouded recessed eye",[side*.045,1.804,.113],[.009,.006,.0035],scorch);
      tube("Ash tear streak",[[side*.047,1.783,.108],[side*.057,1.755,.103],[side*.062,1.72,.084]],.0035,scorch);
      tube("Cracked porcelain cheek",[[side*.077,1.83,.082],[side*.084,1.806,.075],[side*.076,1.785,.09],[side*.09,1.758,.07]],.0017,this.darkMaterial);
      const collar=detail("Raised school-coat collar",[side*.064,1.545,.042],[.065,.09,.028],this.coatMaterial);
      collar.rotation.z=side*-.31;
      tube("Coat lapel seam",[[side*.08,1.52,.083],[side*.12,1.4,.097],[side*.055,1.27,.09]],.005,scorch);
      for(let i=0;i<4;i++) {
        const rag=new THREE.Mesh(new THREE.ConeGeometry(.026,.19+(i%2)*.055,5),this.coatMaterial);
        rag.name="Scorched hanging coat thread";rag.rotation.z=Math.PI+side*.07;
        rag.position.set(side*(.07+i*.037),.81-(i%3)*.026,.03);this.mesh.add(rag);
      }
    }
    tube("Fractured forehead",[[-.035,1.897,.054],[-.012,1.87,.092],[-.021,1.849,.106],[.005,1.829,.11]],.0018,scorch);
    detail("Lower sunken lip",[0,1.68,.088],[.028,.008,.008],scorch);
    const badge=detail("Burned school crest",[-.092,1.385,.087],[.027,.035,.006],scorch);
    tube("School crest stitch",[[-.11,1.399,.095],[-.09,1.41,.096],[-.074,1.395,.095],[-.09,1.37,.096],[-.11,1.399,.095]],.0018,this.material);
    // Break up the smooth primitive shapes into a gaunt, ash-stained human face.
    const cheek=this.material.clone();cheek.color.setHex(0x929987);cheek.emissiveIntensity=.09;
    this.materials.push(cheek);
    for(const part of this.mesh.getObjectsByProperty("name","Sunken cheek")) {
      part.material=cheek;part.scale.set(.021,.029,.006);part.position.z=.064;
    }
    const mouth=this.mesh.getObjectByName("Hollow mouth");mouth.scale.set(.025,.011,.008);mouth.position.y=1.701;
    const nose=this.mesh.getObjectByName("Nose ridge");nose.scale.set(.008,.025,.012);nose.position.z=.106;
    this.mesh.getObjectByName("Lower sunken lip").scale.set(.026,.003,.004);
    for(const socket of this.mesh.getObjectsByProperty("name","Recessed eye socket"))socket.scale.set(.028,.016,.011);
    for(const brow of this.mesh.getObjectsByProperty("name","Raised orbital ridge")){brow.scale.y=.006;brow.rotation.z=Math.sign(brow.position.x)*-.18;}
    for(const shoulder of this.mesh.getObjectsByProperty("name","Drooping shoulder"))shoulder.scale.set(.065,.085,.07);
    for(const hem of this.mesh.getObjectsByProperty("name","Uneven coat hem"))hem.scale.set(.023,.12,.026);
    const scalp=new THREE.Mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,1.12),hair);
    scalp.name="Matted hair crown";scalp.position.set(0,1.76,.01);scalp.scale.set(.127,.16,.115);this.mesh.add(scalp);
    for(let i=0;i<10;i++){
      const x=-.10+i*.020;
      tube("Uneven fringe",[[x,1.875,.07],[x-.012,1.845,.103],[x-.021,1.81+(i%3)*.011,.113]],.004+(i%2)*.002,hair);
    }
    // Ash mottling is authored into the face vertices, so it follows the sculpted surface.
    const faceSkin=this.material.clone();faceSkin.vertexColors=true;this.head.material=faceSkin;this.materials.push(faceSkin);
    const colors=[];
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
      const stain=.81+.13*Math.sin(x*17+y*13)*Math.sin(y*21-z*9);
      colors.push(stain,stain*.99,stain*.94);
    }
    this.head.geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    // A restrained asymmetry reads in silhouette without moving the gameplay sight point.
    this.mesh.getObjectsByProperty("name","Drooping shoulder")[0].position.y-=.035;
    this.mesh.name = "Ash-faced apparition in a scorched school coat";
    this.mesh.traverse((o) => {
      o.layers.enable(APPARITION_LAYER);
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    this.blurRadius = STYLE.blurPixels;
    this.clipPlanes = [];
  }
  setPeek(event, actor) {
    if (actor) actor.visible = false;
    const axis = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      event.peekYaw || 0,
    );
    this.mirror = event.mirror ? -1 : 1;
    this.axis = axis;
    this.mesh.position
      .set(event.at[0], 0, event.at[1])
      .addScaledVector(axis, this.mirror * (event.peekYaw ? 0.4 : 0.25));
    this.mesh.rotation.set(0, event.peekYaw || 0, 0);
    this.peekPosition = this.mesh.position.clone();
    const normal = axis.clone().multiplyScalar(-this.mirror);
    // Only part of the face and shoulder clears the doorway edge. The lower
    // silhouette stays hidden so this reads as a peek, rather than a standing figure.
    this.clipPlanes = [
      new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal,
        this.peekPosition.clone().addScaledVector(normal, STYLE.edgeInset),
      ),
      new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal.clone().negate(),
        this.peekPosition
          .clone()
          .addScaledVector(normal, STYLE.edgeInset + STYLE.visibleStrip),
      ),
      new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.3, 0),
      ),
    ];
    for (const material of this.materials) {
      material.clippingPlanes = this.clipPlanes;
      material.needsUpdate = true;
      material.opacity = 0.95;
    }
    this.mesh.visible = true;
  }
  sightPoint(event) {
    return new THREE.Vector3(event.at[0], 1.8, event.at[1]).add(
      new THREE.Vector3((event.mirror ? -1 : 1) * (event.peekYaw ? 0.35 : 0.2), 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        event.peekYaw || 0,
      ),
    );
  }
  retreat(amount) {
    this.mesh.position
      .copy(this.peekPosition)
      .addScaledVector(this.axis, this.mirror * amount * STYLE.retreatDistance);
  }
  update(camera, opacity = 0.9, time = 0) {
    // Breathing is local to the coat; doorway position and fixed peek orientation stay stable.
    this.torso.scale.z = 0.5 + Math.sin(time * 1.4) * 0.008;
    for (const material of this.materials) material.opacity = Math.max(0, opacity);
  }
  hide() {
    this.mesh.visible = false;
  }
}
