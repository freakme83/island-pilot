import {noise} from './noise.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const WATER_LEVEL_M=19;
export const TERRAIN_TILE=3000,TERRAIN_SEGMENTS=36,TERRAIN_CELL=TERRAIN_TILE/TERRAIN_SEGMENTS;
export const MOUNTAIN=Object.freeze({seed:65021,x:1600,z:4400,radiusXM:3000,radiusZM:2800,reliefM:650});
export function baseGround(x,z){
 const river=560*Math.sin(z*.00026)+180*Math.sin(z*.00073);
 const d=Math.abs(x-river);
 const hills=95+62*Math.sin(x*.00038+.6)*Math.cos(z*.00031)+38*Math.sin(z*.00081+x*.00028)+24*Math.cos(x*.0017-z*.0009);
 const ridge=210*Math.pow(.5+.5*Math.sin(x*.00034+z*.00017-1.2),4);
 return 9+(hills+ridge)*smooth(85,430,d);
}
const angle=-.32+.13*noise(2,5,9,MOUNTAIN.seed),cos=Math.cos(angle),sin=Math.sin(angle);
function rawMountain(x,z){
 const dx=x-MOUNTAIN.x,dz=z-MOUNTAIN.z,u=dx*cos-dz*sin,v=dx*sin+dz*cos;
 const radius=Math.hypot(u/MOUNTAIN.radiusXM,v/MOUNTAIN.radiusZM);if(radius>=1)return 0;
 const main=Math.exp(-((u/880)**2+(v/1080)**2));
 const westShoulder=.72*Math.exp(-(((u+1100)/720)**2+((v-900)/860)**2));
 const eastShoulder=.61*Math.exp(-(((u-950)/680)**2+((v+1150)/820)**2));
 const ridgeline=.22*Math.exp(-(((u+.85*v)/650)**2+(v/2200)**2));
 const peaks=(main**4+westShoulder**4+eastShoulder**4)**.25;
 const detail=1+.08*noise(u/520,2,v/610,MOUNTAIN.seed);
 return (peaks+ridgeline)*detail*(1-smooth(.68,1,radius));
}
// Normalize once, deterministically; no terrain generation in the render/physics loop.
let peak=0,peakX=MOUNTAIN.x,peakZ=MOUNTAIN.z;
for(let dx=-1600;dx<=1600;dx+=25)for(let dz=-1600;dz<=1600;dz+=25){const x=MOUNTAIN.x+dx,z=MOUNTAIN.z+dz,h=rawMountain(x,z);if(h>peak){peak=h;peakX=x;peakZ=z}}
const reliefScale=MOUNTAIN.reliefM/peak;
export const mountainSummit=Object.freeze({x:peakX,z:peakZ});
export function mountainRelief(x,z){return rawMountain(x,z)*reliefScale}
// Only mesh vertices use this analytic function. All surface consumers use ground below.
export function terrainVertexHeight(x,z){return baseGround(x,z)+mountainRelief(x,z)}
const vertexRows=new Map();let cacheSize=0;
function vertex(ix,iz){
 let row=vertexRows.get(ix);if(row?.has(iz))return row.get(iz);
 if(cacheSize>=8192){vertexRows.clear();cacheSize=0;row=null}
 if(!row){row=new Map();vertexRows.set(ix,row)}
 const h=terrainVertexHeight(ix*TERRAIN_CELL-TERRAIN_TILE/2,iz*TERRAIN_CELL-TERRAIN_TILE/2);row.set(iz,h);cacheSize++;return h;
}
// Authoritative surface: the same two triangles used by Three.js PlaneGeometry.
export function ground(x,z){
 const gx=(x+TERRAIN_TILE/2)/TERRAIN_CELL,gz=(z+TERRAIN_TILE/2)/TERRAIN_CELL,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;
 const a=vertex(ix,iz),b=vertex(ix+1,iz),c=vertex(ix,iz+1),d=vertex(ix+1,iz+1);
 return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
}
// One-cell central differences soften facet boundaries for airflow; heights remain exact.
export function terrainGradient(x,z,out){
 out.x=(ground(x+TERRAIN_CELL,z)-ground(x-TERRAIN_CELL,z))/(2*TERRAIN_CELL);
 out.z=(ground(x,z+TERRAIN_CELL)-ground(x,z-TERRAIN_CELL))/(2*TERRAIN_CELL);return out;
}
export const terrain=Object.freeze({height:ground,gradient:terrainGradient});
