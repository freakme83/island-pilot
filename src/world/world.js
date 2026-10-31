import * as THREE from '../vendor/three.js';
import {GLTFLoader,mergeGeometries} from '../vendor/three.js';
import {ground,terrainVertexHeight,TERRAIN_TILE,TERRAIN_SEGMENTS} from './height.js';
import {RUNWAY,RUNWAY_ASPHALT_DEPTH_BIAS,runwayContains} from './runway.js';
export function createWorld({sim,scene,ocean,$}){
const TILE=TERRAIN_TILE,SEGMENTS=TERRAIN_SEGMENTS,RADIUS=3,tiles=new Map();
let terrainVisible=true;
const soil=new THREE.Color(),green=new THREE.Color(0x768968),high=new THREE.Color(0x9d9980),sand=new THREE.Color(0xb8b39a),field=new THREE.Color(0x9a9e77);
const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
// Two static draw calls. Color variation is baked once into broad asphalt
// patches; the paint has its own depth bias, while normal depth occlusion stays on.
const runwayGroup=new THREE.Group(),runwayVisualBaseY=RUNWAY.elevationM+.01;runwayGroup.position.set(RUNWAY.x,runwayVisualBaseY,RUNWAY.z);
const asphaltGeometry=new THREE.PlaneGeometry(RUNWAY.widthM,RUNWAY.lengthM,8,120).rotateX(-Math.PI/2),asphaltColors=[],asphaltTint=new THREE.Color();
for(let i=0;i<asphaltGeometry.attributes.position.count;i++){
 const p=asphaltGeometry.attributes.position,x=p.getX(i),z=p.getZ(i);
 const grain=Math.sin(x*12.9898+z*78.233)*43758.5453;
 const tone=.95+.06*(grain-Math.floor(grain));
 asphaltTint.setRGB(tone,tone,tone);asphaltColors.push(asphaltTint.r,asphaltTint.g,asphaltTint.b);
}
asphaltGeometry.setAttribute('color',new THREE.Float32BufferAttribute(asphaltColors,3));
const asphalt=new THREE.Mesh(asphaltGeometry,new THREE.MeshStandardMaterial({color:0x414849,roughness:1,vertexColors:true,...RUNWAY_ASPHALT_DEPTH_BIAS}));runwayGroup.add(asphalt);
const paint=[];
function marking(width,length,x,z){const g=new THREE.PlaneGeometry(width,length);g.rotateX(-Math.PI/2);g.translate(x,.035,z);paint.push(g)}
for(let z=-520;z<=520;z+=60)marking(.65,20,0,z);
for(const x of [-19,19])marking(.25,1160,x,0);
for(const z of [-565,565])for(const x of [-12,-8,-4,4,8,12])marking(1.8,15,x,z);
const paintGeometry=mergeGeometries(paint,false);paint.forEach(g=>g.dispose());paintGeometry.computeBoundingSphere();const runwayPaint=new THREE.Mesh(paintGeometry,new THREE.MeshStandardMaterial({color:0xd8d9cf,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));runwayGroup.add(runwayPaint);scene.add(runwayGroup);
function makeTile(tx,tz){
 const g=new THREE.PlaneGeometry(TILE,TILE,SEGMENTS,SEGMENTS);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+tx*TILE,z=p.getZ(i)+tz*TILE,h=terrainVertexHeight(x,z);p.setY(i,h);
  soil.copy(green).lerp(high,THREE.MathUtils.smoothstep(h,130,390));
  const patch=Math.sin(Math.floor(x/300)*3.7+Math.floor(z/440)*1.8)*.5+.5;
  soil.lerp(field,patch*.43*(1-THREE.MathUtils.smoothstep(h,150,300)));
  if(h<35)soil.lerp(sand,1-THREE.MathUtils.smoothstep(h,19,35));
  colors.push(soil.r,soil.g,soil.b);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 const m=new THREE.Mesh(g,terrainMat);m.position.set(tx*TILE,0,tz*TILE);m.visible=terrainVisible;scene.add(m);return m;
}
let tileX=Infinity,tileZ=Infinity;
function setTerrainVisible(visible){terrainVisible=visible;for(const mesh of tiles.values())mesh.visible=visible}
function setWaterVisible(visible){ocean.visible=visible}
function setRunwayVisualOffset(metres){runwayGroup.position.y=runwayVisualBaseY+metres}
function setRunwayPaintVisible(visible){runwayPaint.visible=visible}
function updateTerrain(){
 const cx=Math.round(sim.p.x/TILE),cz=Math.round(sim.p.z/TILE);if(cx===tileX&&cz===tileZ)return;tileX=cx;tileZ=cz;
 const wanted=new Set();for(let x=cx-RADIUS;x<=cx+RADIUS;x++)for(let z=cz-RADIUS;z<=cz+RADIUS;z++)wanted.add(x+','+z);
 for(const [key,m] of tiles)if(!wanted.has(key)){scene.remove(m);m.geometry.dispose();tiles.delete(key);}
 for(const key of wanted)if(!tiles.has(key)){const [x,z]=key.split(',').map(Number);tiles.set(key,makeTile(x,z));}
 ocean.position.x=cx*TILE;ocean.position.z=cz*TILE;
}
// Shared with physics, AGL and atmosphere.
const surfaceHeight=ground;
const TREE_TILE=600,TREE_RADIUS=3,treeTiles=new Map(),treeTemplates=[],treeStats={pine:0,canopy:0};
let treeX=Infinity,treeZ=Infinity;
function randomFor(x,z){let n=(Math.imul(x,73856093)^Math.imul(z,19349663)^16381)>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function makeTreeTile(tx,tz){
 const random=randomFor(tx,tz),positions=[[],[]];
 for(let i=0;i<360;i++){
  const x=(tx-.5+random())*TREE_TILE,z=(tz-.5+random())*TREE_TILE,h=surfaceHeight(x,z);
  const woods=.5+.25*Math.sin(x*.0041+Math.sin(z*.0032))+.25*Math.cos(z*.0048-x*.0019);
  const patch=.5+.5*Math.sin(x*.014+z*.009);
  const density=.055+.64*THREE.MathUtils.smoothstep(woods,.38,.77)+.13*THREE.MathUtils.smoothstep(patch,.82,.98);
  const corridor=Math.abs(x-(850+230*Math.sin(z*.00065)));
  const slope=Math.hypot(surfaceHeight(x+5,z)-h,surfaceHeight(x,z+5)-h)/5;
  if(random()>density||h<35||corridor<55||slope>.48||runwayContains(x,z,12))continue;
  const species=random()<(woods>.62?.7:.42)?0:1;
  positions[species].push({x:x-tx*TREE_TILE,z:z-tz*TREE_TILE,y:h,scale:.85+random()*.65,yaw:random()*Math.PI*2,tint:.9+random()*.18});
 }
 const group=new THREE.Group();group.position.set(tx*TREE_TILE,0,tz*TREE_TILE);const dummy=new THREE.Object3D(),tint=new THREE.Color();
 for(let species=0;species<2;species++){
  const items=positions[species];if(!items.length)continue;const template=treeTemplates[species];
  const mesh=new THREE.InstancedMesh(template.geometry,template.material,items.length);
  for(let i=0;i<items.length;i++){const v=items[i];dummy.position.set(v.x,v.y-template.base*v.scale-.04,v.z);dummy.rotation.set(0,v.yaw,0);dummy.scale.setScalar(v.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);tint.setRGB(v.tint,v.tint,v.tint);mesh.setColorAt(i,tint);}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);
 }
 group.userData.counts=positions.map(p=>p.length);scene.add(group);return group;
}
function updateTrees(){
 if(treeTemplates.length!==2)return;
 const cx=Math.round(sim.p.x/TREE_TILE),cz=Math.round(sim.p.z/TREE_TILE);if(cx===treeX&&cz===treeZ)return;treeX=cx;treeZ=cz;
 const wanted=new Set();for(let x=cx-TREE_RADIUS;x<=cx+TREE_RADIUS;x++)for(let z=cz-TREE_RADIUS;z<=cz+TREE_RADIUS;z++)wanted.add(x+','+z);
 for(const [key,g]of treeTiles)if(!wanted.has(key)){scene.remove(g);g.children.forEach(m=>m.dispose());treeTiles.delete(key);}
 for(const key of wanted)if(!treeTiles.has(key)){const [x,z]=key.split(',').map(Number);treeTiles.set(key,makeTreeTile(x,z));}
 treeStats.pine=0;treeStats.canopy=0;for(const g of treeTiles.values()){treeStats.pine+=g.userData.counts[0];treeStats.canopy+=g.userData.counts[1];}
}
function loadTree(path){return new GLTFLoader().loadAsync(path);}
Promise.all([loadTree('./assets/models/tall-pine-tree.glb'),loadTree('./assets/models/broad-canopy-shade-tree.glb')]).then(models=>{
 for(const model of models){
  model.scene.updateMatrixWorld(true);const parts=[];let material;
  model.scene.traverse(o=>{if(o.isMesh){parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));material=o.material;}});
  const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.computeBoundingBox();
  treeTemplates.push({geometry,material,base:geometry.boundingBox.min.y});
 }
 updateTrees();
}).catch(error=>{console.error(error);$('error').hidden=false;$('error').textContent='Tree assets could not load. Reopen the file.';});
updateTerrain();

return {updateTerrain,updateTrees,surfaceHeight,treeStats,setTerrainVisible,setWaterVisible,setRunwayVisualOffset,setRunwayPaintVisible};
}
