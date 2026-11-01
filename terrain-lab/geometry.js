import * as T from './vendor/three.module.min.js';

// The same DEM sample always has the same world-space normal, regardless of tile or LOD.
export function normalAt(meta,data,i,j){
 const {width:w,height:h,widthMeters:W,depthMeters:D}=meta;
 const il=Math.max(0,i-1),ir=Math.min(w-1,i+1);
 const jt=Math.max(0,j-1),jb=Math.min(h-1,j+1);
 const dx=(data[j*w+ir]-data[j*w+il])/((ir-il)*W/(w-1));
 const dz=(data[jb*w+i]-data[jt*w+i])/((jb-jt)*D/(h-1));
 const length=Math.hypot(dx,1,dz);
 return [-dx/length,1/length,-dz/length];
}

// Edge bits are north, east, south, west. Matching LOD edges share all vertices.
export function skirtMaskFor(tile,byOrigin){
 const x=tile.x0,z=tile.z0,step=tile.nextStep;
 const neighbors=[[x,z-128],[x+128,z],[x,z+128],[x-128,z]];
 return neighbors.reduce((mask,[nx,nz],edge)=>{
  const neighbor=byOrigin.get(nx+','+nz);
  return mask|(neighbor&&neighbor.nextStep!==step?1<<edge:0);
 },0);
}

export function makeTileGeometry(meta,data,tile,step,skirtMask=0){
 const {width:w,height:h,widthMeters:W,depthMeters:D}=meta;
 const xs=[],zs=[];
 for(let i=tile.x0;i<tile.x1;i+=step)xs.push(i);xs.push(tile.x1);
 for(let j=tile.z0;j<tile.z1;j+=step)zs.push(j);zs.push(tile.z1);
 const vertices=[],colors=[],normals=[],indices=[],col=new T.Color();
 for(const j of zs)for(const i of xs){
  const x=i/(w-1)*W-W/2,z=j/(h-1)*D-D/2,y=data[j*w+i];
  vertices.push(x,y,z);
  normals.push(...normalAt(meta,data,i,j));
  col.setRGB(...(y<20?[.53,.52,.35]:y<250?[.33,.44,.26]:y<700?[.40,.42,.31]:[.52,.51,.45]));
  colors.push(col.r,col.g,col.b);
 }
 const nx=xs.length,nz=zs.length;
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
  const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
  if(!(vertices[a*3+1]===0&&vertices[c*3+1]===0&&vertices[b*3+1]===0))indices.push(a,c,b);
  if(!(vertices[b*3+1]===0&&vertices[c*3+1]===0&&vertices[d*3+1]===0))indices.push(b,c,d);
 }
 const edges=[
  [Array.from({length:nx},(_,i)=>i),0,-1],
  [Array.from({length:nz},(_,i)=>i*nx+nx-1),1,0],
  [Array.from({length:nx},(_,i)=>(nz-1)*nx+nx-1-i),0,1],
  [Array.from({length:nz},(_,i)=>(nz-1-i)*nx),-1,0]
 ];
 for(let side=0;side<4;side++){
  if(!(skirtMask&(1<<side)))continue;
  const [edge,normalX,normalZ]=edges[side];
  let previousTop=-1,previousBottom=-1;
  for(const source of edge){
   const top=vertices.length/3,bottom=top+1;
   const offset=source*3;
   vertices.push(vertices[offset],vertices[offset+1],vertices[offset+2]);
   vertices.push(vertices[offset],vertices[offset+1]-120,vertices[offset+2]);
   for(let n=0;n<2;n++){
    normals.push(normalX,0,normalZ);
    colors.push(colors[offset],colors[offset+1],colors[offset+2]);
   }
   if(previousTop>=0)indices.push(previousTop,top,bottom,previousTop,bottom,previousBottom);
   previousTop=top;previousBottom=bottom;
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 g.setIndex(indices);
 g.computeBoundingSphere();
 return g;
}
