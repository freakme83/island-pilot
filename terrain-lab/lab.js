import * as T from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {makeTerrain} from './height.js';
const $=id=>document.getElementById(id), canvas=$('view');
try {
const [meta,buffer]=await Promise.all([fetch('./data/metadata.json').then(r=>{if(!r.ok)throw Error('metadata unavailable');return r.json()}),fetch('./data/heights.f32').then(r=>{if(!r.ok)throw Error('height data unavailable');return r.arrayBuffer()})]);
const terrain=makeTerrain(meta,new Float32Array(buffer));
const scene=new T.Scene();scene.background=new T.Color(0xa9c9db);scene.fog=new T.Fog(0xa9c9db,65000,150000);
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
const camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,2,160000);camera.position.set(25000,50000,55000);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,0,0);orbit.maxDistance=120000;orbit.minDistance=20;orbit.update();
scene.add(new T.HemisphereLight(0xd9ecff,0x77765f,2));const sun=new T.DirectionalLight(0xfff1d5,2);sun.position.set(-10000,30000,18000);scene.add(sun);
const ocean=new T.Mesh(new T.PlaneGeometry(200000,200000),new T.MeshLambertMaterial({color:0x347d9b}));ocean.rotation.x=-Math.PI/2;scene.add(ocean);
const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
const lineMat=new T.LineBasicMaterial({color:0xffe591});
const {width:w,height:h,widthMeters:W,depthMeters:D}=meta, cells=128, tiles=[];
function pos(i,j){return [i/(w-1)*W-W/2,j/(h-1)*D-D/2]}
function geometry(tile,step){
 const xs=[],zs=[];for(let i=tile.x0;i<tile.x1;i+=step)xs.push(i);xs.push(tile.x1);for(let j=tile.z0;j<tile.z1;j+=step)zs.push(j);zs.push(tile.z1);
 const vertices=[],colors=[],indices=[];const col=new T.Color();
 for(const j of zs)for(const i of xs){const [x,z]=pos(i,j),y=terrain.data[j*w+i];vertices.push(x,y,z);col.setRGB(...(y<20?[.53,.52,.35]:y<250?[.33,.44,.26]:y<700?[.40,.42,.31]:[.52,.51,.45]));colors.push(col.r,col.g,col.b)}
 const nx=xs.length,nz=zs.length;
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){let a=j*nx+i,b=a+1,c=a+nx,d=c+1; // Omit only flat sea-level triangles; zero is still retained in authoritative samples.
 if(!(vertices[a*3+1]===0&&vertices[c*3+1]===0&&vertices[b*3+1]===0))indices.push(a,c,b);
 if(!(vertices[b*3+1]===0&&vertices[c*3+1]===0&&vertices[d*3+1]===0))indices.push(b,c,d);
 }
 // Overlapping downward skirts bridge mismatched boundary sampling at LOD transitions.
 const edges=[Array.from({length:nx},(_,i)=>i),Array.from({length:nz},(_,i)=>i*nx+nx-1),Array.from({length:nx},(_,i)=>(nz-1)*nx+nx-1-i),Array.from({length:nz},(_,i)=>(nz-1-i)*nx)];
 for(const edge of edges){let prev=-1;for(const top of edge){const bottom=vertices.length/3;vertices.push(vertices[top*3],vertices[top*3+1]-120,vertices[top*3+2]);colors.push(colors[top*3],colors[top*3+1],colors[top*3+2]);if(prev>=0){indices.push(prev,top,bottom,prev,bottom,bottom-1)}prev=top}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
for(let z=0;z<h-1;z+=cells)for(let x=0;x<w-1;x+=cells){const tile={x0:x,x1:Math.min(x+cells,w-1),z0:z,z1:Math.min(z+cells,h-1),step:0,mesh:null};const [x0,z0]=pos(tile.x0,tile.z0),[x1,z1]=pos(tile.x1,tile.z1);tile.cx=(x0+x1)/2;tile.cz=(z0+z1)/2;const pts=[new T.Vector3(x0,8,z0),new T.Vector3(x1,8,z0),new T.Vector3(x1,8,z1),new T.Vector3(x0,8,z1),new T.Vector3(x0,8,z0)];tile.line=new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat);tile.line.visible=false;scene.add(tile.line);tiles.push(tile)}
function updateLOD(){for(const tile of tiles){let dist=Math.hypot(camera.position.x-tile.cx,camera.position.z-tile.cz,Math.max(camera.position.y,0)*.7);let step=$('lod').checked?(dist<6000?1:dist<16000?2:dist<35000?4:8):4;if(step!==tile.step){const g=geometry(tile,step);if(tile.mesh){const old=tile.mesh.geometry;tile.mesh.geometry=g;old.dispose()}else{tile.mesh=new T.Mesh(g,material);scene.add(tile.mesh)}tile.step=step}tile.line.visible=$('bounds').checked}}
let mode='orbit',keys=new Set(),yaw=0,pitch=0;const euler=new T.Euler(0,0,0,'YXZ');
function syncLook(){euler.setFromQuaternion(camera.quaternion);yaw=euler.y;pitch=euler.x}
$('mode').onchange=()=>{mode=$('mode').value;orbit.enabled=mode==='orbit';keys.clear();if(mode==='fly')syncLook();else document.exitPointerLock?.()};
canvas.addEventListener('click',()=>{if(mode==='fly')canvas.requestPointerLock()});
document.addEventListener('mousemove',e=>{if(mode==='fly'&&document.pointerLockElement===canvas){yaw-=e.movementX*.002;pitch=Math.max(-1.55,Math.min(1.55,pitch-e.movementY*.002));camera.quaternion.setFromEuler(euler.set(pitch,yaw,0))}});
window.addEventListener('keydown',e=>{if(mode==='fly'&&document.pointerLockElement===canvas&&['KeyW','KeyA','KeyS','KeyD','KeyR','KeyF'].includes(e.code)){keys.add(e.code);e.preventDefault()}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)keys.clear()});
const presets={overview:[[25000,50000,55000],[0,0,0]],coast:[[13000,800,15000],[4000,100,11000]],mountain:[[5000,3000,-16000],[1505,1286,-21029]],ground:[[3000,450,7000],[2500,330,4500]]};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{let [p,t]=presets[b.dataset.preset];camera.position.fromArray(p);orbit.target.fromArray(t);camera.lookAt(orbit.target);if(mode==='orbit')orbit.update();else syncLook();updateLOD()});
$('lod').onchange=updateLOD;$('bounds').onchange=updateLOD;$('ocean').onchange=()=>ocean.visible=$('ocean').checked;$('wire').onchange=()=>material.wireframe=$('wire').checked;
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
let last=performance.now(),lastLOD=0,lastStats=0,frames=[];const movement=new T.Vector3();
function animate(now){requestAnimationFrame(animate);const raw=now-last;last=now;const dt=Math.min(raw/1000,.1);if(raw>0&&raw<2000)frames.push(raw);if(frames.length>300)frames.shift();if(mode==='fly'&&keys.size){movement.set((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),0,(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0));if(movement.lengthSq())movement.normalize().applyQuaternion(camera.quaternion);movement.y+=(keys.has('KeyR')?1:0)-(keys.has('KeyF')?1:0);camera.position.addScaledVector(movement,Number($('speed').value)*dt)}else if(mode==='orbit')orbit.update();if(now-lastLOD>500){updateLOD();lastLOD=now}renderer.render(scene,camera);if(now-lastStats>500){const sorted=[...frames].sort((a,b)=>a-b),avg=frames.reduce((a,b)=>a+b,0)/frames.length,p99=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.99))],ground=terrain.heightAt(camera.position.x,camera.position.z);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const visible=tiles.filter(t=>t.mesh&&frustum.intersectsObject(t.mesh)).length;$('stats').textContent=`FPS ${(1000/avg).toFixed(1)}  ·  1% low ${(1000/p99).toFixed(1)}  ·  frame ${avg.toFixed(1)} ms avg / ${p99.toFixed(1)} ms p99\nDraw calls ${renderer.info.render.calls}  ·  triangles ${renderer.info.render.triangles.toLocaleString()}  ·  visible tiles ${visible}/${tiles.length}\nCamera ${camera.position.y.toFixed(0)} m ASL  ·  AGL ${ground===null?'outside DEM':(camera.position.y-ground).toFixed(0)+' m'}\nLOD ${$('lod').checked?'1 / 2 / 4 / 8 samples by distance':'fixed 4 samples'} · source ~30 m`;lastStats=now}}
updateLOD();$('status').textContent=`${(W/1000).toFixed(2)} × ${(D/1000).toFixed(2)} km · elevation ${meta.minElevation.toFixed(1)} to ${meta.maxElevation.toFixed(1)} m`;requestAnimationFrame(animate);
} catch(e) {console.error(e);$('status').textContent='Could not load terrain: '+e.message+' — run a local HTTP server.'}
