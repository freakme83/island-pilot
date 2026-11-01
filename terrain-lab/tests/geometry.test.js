import assert from 'node:assert/strict';
import {normalAt,skirtMaskFor,makeTileGeometry} from '../geometry.js';

const meta={width:257,height:257,widthMeters:256,depthMeters:256};
const data=new Float32Array(meta.width*meta.height);
for(let j=0;j<meta.height;j++)for(let i=0;i<meta.width;i++)data[j*meta.width+i]=10+.25*i+.125*j;
const left={x0:0,x1:128,z0:0,z1:128,nextStep:4};
const right={x0:128,x1:256,z0:0,z1:128,nextStep:4};
const byOrigin=new Map([['0,0',left],['128,0',right]]);
assert.equal(skirtMaskFor(left,byOrigin),0);
assert.equal(skirtMaskFor(right,byOrigin),0);
right.nextStep=2;
assert.equal(skirtMaskFor(left,byOrigin),2);
assert.equal(skirtMaskFor(right,byOrigin),8);
const expected=[-.25,1,-.125].map(x=>x/Math.hypot(.25,1,.125));
for(const [i,j] of [[0,0],[128,64],[256,256]]){
 const n=normalAt(meta,data,i,j);
 n.forEach((x,k)=>assert.ok(Math.abs(x-expected[k])<1e-6));
}
const base=makeTileGeometry(meta,data,left,4,0);
const skirt=makeTileGeometry(meta,data,left,4,2);
const adjacent=makeTileGeometry(meta,data,right,2,8);
const basePos=base.getAttribute('position'),baseNormal=base.getAttribute('normal');
const skirtPos=skirt.getAttribute('position'),skirtNormal=skirt.getAttribute('normal');
assert.equal(basePos.count,33*33);
assert.ok(skirtPos.count>basePos.count);
for(let k=0;k<basePos.count;k++)for(let axis=0;axis<3;axis++){
 assert.equal(skirtNormal.array[k*3+axis],baseNormal.array[k*3+axis]);
 assert.ok(Number.isFinite(skirtNormal.array[k*3+axis]));
}
const leftEdge=32+16*33,rightEdge=8*65;
for(let axis=0;axis<3;axis++){
 assert.ok(Math.abs(baseNormal.array[leftEdge*3+axis]-adjacent.getAttribute('normal').array[rightEdge*3+axis])<1e-6);
}
for(let k=basePos.count;k<skirtPos.count;k++)assert.equal(skirtNormal.array[k*3+1],0);
assert.ok(skirt.boundingSphere.radius>0);
let disposed=false;skirt.addEventListener('dispose',()=>disposed=true);skirt.dispose();assert.equal(disposed,true);
base.dispose();adjacent.dispose();
console.log('Terrain geometry checks passed');
