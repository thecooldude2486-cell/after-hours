import * as THREE from "../../vendor/three.module.js";
/** Paper relief stays outside the wall; state variants restore a flat clean sheet. */
export function paperGeometry(width = 2.25, height = 1.5, seed = 1) {
  const g = new THREE.PlaneGeometry(width, height, 32, 20),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      u = x / width + 0.5,
      v = y / height + 0.5;
    const edge = Math.pow(
      Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2,
      8,
    );
    const fold =
      Math.exp(-Math.pow((u - 0.44) / 0.028, 2)) * 0.009 +
      Math.exp(-Math.pow((v - 0.58) / 0.026, 2)) * 0.006;
    p.setZ(
      i,
      0.004 +
        edge * (0.014 + 0.009 * Math.sin(u * 24 + v * 17 + seed)) +
        fold +
        Math.sin(u * 21 + seed) * Math.sin(v * 29) * 0.002,
    );
  }
  g.computeVertexNormals();
  return g;
}
export function paperMask(seed = 1, torn = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(3 + Math.abs(Math.sin(i * 4.7 + seed)) * 4, t * 256);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(t * 256, 250 - Math.abs(Math.sin(i * 2.3 + seed)) * 5);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(250 - Math.abs(Math.sin(i * 3.8 + seed)) * 5, (1 - t) * 256);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo((1 - t) * 256, 3 + Math.abs(Math.sin(i * 3.1 + seed)) * 4);
  }
  g.closePath();
  g.fill();
  if(torn){
    g.fillStyle='#000';
    for(const points of [
      [[215,0],[256,0],[256,48],[242,37],[236,39],[224,19]],
      [[0,157],[18,166],[7,171],[17,180],[0,188]],
      [[96,256],[105,235],[111,249],[120,240],[126,256]],
    ]){
      g.beginPath();g.moveTo(...points[0]);for(const p of points.slice(1))g.lineTo(...p);g.closePath();g.fill();
    }
  }
  const texture = new THREE.CanvasTexture(c);
  return texture;
}

/** Readable ink on stained, creased stock, with a torn silhouette in the scene. */
export function ageNote(mesh, title, seed=1) {
  const {width=.6,height=.4}=mesh.geometry.parameters;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=680;
  const g=canvas.getContext('2d');
  const random=i=>{const n=Math.sin(seed*19.31+i*78.23)*43758.5453;return n-Math.floor(n);};
  g.fillStyle='#c8b58c';g.fillRect(0,0,1024,680);
  for(let i=0;i<1300;i++){
    g.fillStyle=i%2?'#49392213':'#fff2cc19';
    g.fillRect(random(i)*1024,random(i+1300)*680,1+random(i+2600)*5,1+random(i+3900)*3);
  }
  for(let i=0;i<10;i++){
    g.fillStyle='#61401f0a';g.beginPath();g.ellipse(random(i+5)*1024,random(i+21)*680,60+random(i+30)*180,20+random(i+50)*60,random(i)*3,0,Math.PI*2);g.fill();
  }
  for(const x of [325,690]){
    g.fillStyle='#533e251e';g.fillRect(x,0,5,680);g.fillStyle='#fff5d52c';g.fillRect(x+5,0,3,680);
  }
  g.fillStyle='#382d24';g.font='italic 56px Georgia';g.textAlign='center';g.fillText(title,500,185,780);
  g.strokeStyle='#48372570';g.lineWidth=2;
  for(let row=0;row<7;row++){
    g.beginPath();for(let col=0;col<38;col++)g.lineTo(125+col*19,265+row*39+random(row*40+col)*9);g.stroke();
  }
  mesh.geometry.dispose();mesh.geometry=paperGeometry(width,height,seed);
  mesh.material.map?.dispose();mesh.material.map=new THREE.CanvasTexture(canvas);
  mesh.material.map.colorSpace=THREE.SRGBColorSpace;
  mesh.material.alphaMap=paperMask(seed,true);mesh.material.transparent=true;mesh.material.alphaTest=.5;
  mesh.material.color.setHex(0xffffff);mesh.material.roughness=1;mesh.material.needsUpdate=true;
  mesh.userData.agedNote=true;
  return mesh;
}
