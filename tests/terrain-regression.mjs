import assert from 'node:assert/strict';
import {Vector3,Quaternion,PlaneGeometry} from '../src/vendor/three.js';
import {MOUNTAIN,mountainSummit,mountainRelief,baseGround,ground,terrain,terrainVertexHeight,TERRAIN_TILE,TERRAIN_SEGMENTS} from '../src/world/height.js';
import {Atmosphere,createConditions} from '../src/physics/atmosphere.js';
import {TerrainCollision} from '../src/physics/terrain-collision.js';
import {Flight} from '../src/physics/Flight.js';
import {createRecorder} from '../src/telemetry/recorder.js';

const peak=mountainSummit;
assert.ok(Math.abs(mountainRelief(peak.x,peak.z)-650)<.1);
assert.ok(mountainRelief(550,5000)>300&&mountainRelief(550,5000)<550);
assert.ok(mountainRelief(2850,3600)>300&&mountainRelief(2850,3600)<550);
assert.equal(mountainRelief(-1200,0),0);
const stableHeight=ground(peak.x,peak.z);
for(let i=0;i<8500;i++)ground(25000+i*84,-30000);
assert.equal(ground(peak.x,peak.z),stableHeight,'terrain stays deterministic across cache eviction');

// Check actual PlaneGeometry indices and interpolated triangle planes, including tile edges.
function meshHeight(x,z){
 const tx=Math.round(x/TERRAIN_TILE),tz=Math.round(z/TERRAIN_TILE),g=new PlaneGeometry(TERRAIN_TILE,TERRAIN_TILE,TERRAIN_SEGMENTS,TERRAIN_SEGMENTS);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,index=g.index.array;
 for(let i=0;i<p.count;i++)p.setY(i,terrainVertexHeight(p.getX(i)+tx*TERRAIN_TILE,p.getZ(i)+tz*TERRAIN_TILE));
 const cell=TERRAIN_TILE/TERRAIN_SEGMENTS,ix=Math.min(TERRAIN_SEGMENTS-1,Math.floor((x-tx*TERRAIN_TILE+TERRAIN_TILE/2)/cell)),iz=Math.min(TERRAIN_SEGMENTS-1,Math.floor((z-tz*TERRAIN_TILE+TERRAIN_TILE/2)/cell));
 let result=null;
 for(const offset of [0,3]){
  const a=index[(iz*TERRAIN_SEGMENTS+ix)*6+offset],b=index[(iz*TERRAIN_SEGMENTS+ix)*6+offset+1],c=index[(iz*TERRAIN_SEGMENTS+ix)*6+offset+2];
  const ax=p.getX(a)+tx*TERRAIN_TILE,az=p.getZ(a)+tz*TERRAIN_TILE,bx=p.getX(b)+tx*TERRAIN_TILE,bz=p.getZ(b)+tz*TERRAIN_TILE,cx=p.getX(c)+tx*TERRAIN_TILE,cz=p.getZ(c)+tz*TERRAIN_TILE;
  const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz),wa=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,wb=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,wc=1-wa-wb;
  if(Math.min(wa,wb,wc)>=-1e-6)result=wa*p.getY(a)+wb*p.getY(b)+wc*p.getY(c);
 }
 g.dispose();assert.notEqual(result,null);return result;
}
for(const [x,z]of [[peak.x,peak.z],[1499.99,4200],[1500.01,4200],[400,4375],[2600,4375],[550,5000]])assert.ok(Math.abs(meshHeight(x,z)-ground(x,z))<.002,'rendered triangles and shared surface agree');
assert.ok(Math.abs(ground(1500-1e-5,4200)-ground(1500+1e-5,4200))<1e-4,'tile seam continuous');

function flow(x,z,from,speed,clearance=180){
 const a=new Atmosphere('light',17391,terrain),p=new Vector3(x,ground(x,z)+clearance,z);a.set({fromDeg:from,speedMps:speed,intensity:0});a.reset(p);return {...a.center.terrain};
}
const westX=peak.x-900,eastX=peak.x+900,z=peak.z;
const west=flow(westX,z,270,8),east=flow(eastX,z,270,8),reversedWest=flow(westX,z,90,8),reversedEast=flow(eastX,z,90,8);
assert.ok(west.verticalMps>.5&&east.verticalMps<-.4);
assert.ok(reversedWest.verticalMps<-.4&&reversedEast.verticalMps>.5);
assert.ok(east.turbulenceMultiplier>1&&west.turbulenceMultiplier===1);
assert.equal(flow(westX,z,270,0).verticalMps,0);
assert.ok(Math.abs(flow(westX,z,270,.01).verticalMps)<.01);
assert.ok(flow(westX,z,270,12).verticalMps>flow(westX,z,270,2).verticalMps);
assert.ok(flow(westX,z,270,12,0).verticalMps<=4);
assert.ok(Math.abs(flow(eastX,z,270,12,0).verticalMps)<=3);
assert.ok(Math.abs(flow(westX,z,270,8,3000).verticalMps)<.02);
const flat={height:()=>100,gradient:(x,z,out)=>{out.x=0;out.z=0;return out}},bare=new Atmosphere('light'),onFlat=new Atmosphere('light',17391,flat),flatPosition=new Vector3(400,300,600),aOut=createConditions(),bOut=createConditions();
bare.sample(flatPosition,15,aOut);onFlat.sample(flatPosition,15,bOut);assert.deepEqual(aOut.wind.toArray(),bOut.wind.toArray());
const transitioning=new Atmosphere('light',17391,terrain),position=new Vector3(westX,ground(westX,z)+180,z);transitioning.set({fromDeg:270,speedMps:8,intensity:0});transitioning.reset(position);let previous=transitioning.center.terrain.verticalMps;
transitioning.set({fromDeg:90});for(let i=1;i<=360;i++){transitioning.update(position,i/120,1/120);const current=transitioning.center.terrain.verticalMps;assert.ok(Math.abs(current-previous)<.04);previous=current}assert.ok(previous<0);
transitioning.set({preset:'off'});assert.equal(transitioning.wind.length(),0);assert.equal(transitioning.center.terrain.verticalMps,0);

const collision=new TerrainCollision(),q=new Quaternion();
const x0=peak.x-4000,x1=peak.x+4000,y=Math.max(ground(x0,z),ground(x1,z))+100;
const start=new Vector3(x0,y,z),end=new Vector3(x1,y,z);assert.ok(collision.clearance(start,q)>50&&collision.clearance(end,q)>50);
const swept=collision.sweep(start,q,end,q),impact=swept?{...swept}:null;assert.ok(impact&&impact.fraction>0&&impact.fraction<1,'long high-speed segment cannot tunnel through mountain');
const slope=new Vector3(westX,ground(westX,z)+3,z),bank=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-.4);
assert.ok(slope.y-ground(slope.x,slope.z)>2.5);const wingImpact=collision.sweep(slope,bank,slope,bank);assert.ok(wingImpact?.proxy.includes('right'),'wing hits although center is above terrain');
const above=new Vector3(westX,ground(westX,z)+25,z);assert.equal(collision.sweep(above,q,above,q),null);
const sim=new Flight('bush',new Atmosphere('off'));assert.ok(collision.clearance(sim.p,sim.q)>150);
const water=collision.sweep(new Vector3(0,20,0),q,new Vector3(0,20,0),q);assert.equal(water?.surface,'water');
sim.p.set(westX,ground(westX,z)+8,z);sim.v.set(0,-120,0);let reset=false;
for(let i=0;i<30&&!reset;i++)reset=sim.step(1/120);
assert.equal(reset,true);assert.ok(sim.lastImpact);assert.ok(collision.clearance(sim.p,sim.q)>150);assert.equal(sim.p.x,-1200);
assert.ok(Math.abs(sim.lastImpact.contactPositionM[1]-ground(sim.lastImpact.contactPositionM[0],sim.lastImpact.contactPositionM[2]))<1e-6);

// Same initial aircraft state: real slope airflow must change the flight path and export SI diagnostics.
const gains=[];
for(const enabled of [false,true]){
 const a=new Atmosphere('light',17391,enabled?terrain:null);a.set({fromDeg:270,speedMps:8,intensity:0});const s=new Flight('bush',a);
 s.p.set(westX,ground(westX,z)+180,z);a.reset(s.p);s.v.set(8,0,s.profile.cruise);const y0=s.p.y;
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}}});return nodes.get(id)};
 const rec=enabled?createRecorder({sim:s,keys:new Set(),renderer:{info:{render:{calls:0,triangles:0}}},ground,$,isPaused:()=>false}):null;
 rec?.startRecording();for(let i=0;i<1200;i++){const reset=s.step(1/120);assert.equal(reset,false);rec?.recordTick(reset,1/120)}rec?.stopRecording();gains.push(s.p.y-y0);
 if(rec){const data=JSON.parse(JSON.stringify(rec.recorder.data)),sample=data.samples[0];assert.ok(data.summary);assert.ok(sample.terrain.verticalAirflowMps>.5);assert.equal(sample.terrain.flowRegime,'WINDWARD LIFT');assert.ok(Math.abs(sample.terrain.heightM-ground(sample.positionM[0],sample.positionM[2]))<1e-9)}
}
assert.ok(Math.abs(gains[0])<.01&&gains[1]>5,'terrain lift changes the actual flight path');
console.log('terrain: relief 650 m, mesh agreement <2 mm, spawn/seams, direction/speed/altitude response, smooth wind reversal, swept proxies and safe impact reset passed');
console.log({summit:{...peak,worldHeightM:ground(peak.x,peak.z)},westWind:{westLiftMps:west.verticalMps,eastSinkMps:east.verticalMps},eastWind:{westSinkMps:reversedWest.verticalMps,eastLiftMps:reversedEast.verticalMps},highSpeedContactProxy:impact.proxy,tenSecondAltitudeGainM:{withoutTerrain:gains[0],withTerrain:gains[1]}});
