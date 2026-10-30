import assert from 'node:assert/strict';
import {Flight} from '../src/physics/Flight.js';
import {Atmosphere} from '../src/physics/atmosphere.js';
import {aircraftHeading,headingFromXZ,shortestHeadingDelta} from '../src/rendering/heading.js';
import {createRecorder} from '../src/telemetry/recorder.js';
import {ground} from '../src/world/height.js';

const dt=1/120;
const state=s=>[...s.p.toArray(),...s.v.toArray(),...s.q.toArray(),...s.w.toArray(),s.stall,s.throttle];
for(const profile of ['bush','fighter']){
 const legacy=new Flight(profile),off=new Flight(profile,new Atmosphere('off'));
 assert.deepEqual(state(off),state(legacy));
 for(let i=0;i<2400;i++){
  const control=i<600?{}:i<1200?{roll:.25,throttle:1}:i<1800?{pitch:-.4,yaw:.2}:{throttle:-1};
  legacy.step(dt,control);off.step(dt,control);
  if(i%300===0)assert.deepEqual(state(off),state(legacy),`${profile} Off step ${i}`);
 }
}

const steady=new Atmosphere('light');steady.set({speedMps:5,fromDeg:270,intensity:0});
const flight=new Flight('bush',steady),initial=flight.p.clone();
for(let i=0;i<3600;i++)flight.step(dt);
assert.ok(flight.p.x-initial.x>100,'westerly wind drifts aircraft east');
assert.ok(Math.abs(flight.w.z)<1e-10,'uniform wind does not impose roll');
assert.ok(Math.abs(flight.q.z)<1e-10,'uniform wind does not accumulate bank');

function trace(){const weather=new Atmosphere('light',223344),f=new Flight('bush',weather),out=[];let previous=weather.wind.clone();for(let i=0;i<3600;i++){
 f.step(dt,i>1200&&i<1400?{roll:.12}:{});
 if(i%60===0){assert.ok(weather.wind.distanceTo(previous)<2,'gusts remain continuous');previous.copy(weather.wind);out.push(state(f));}
 }return out}
assert.deepEqual(trace(),trace(),'identical seed and controls replay the same trajectory');
assert.notDeepEqual(trace()[30],state(new Flight('bush',new Atmosphere('off'))),'light conditions disturb flight');

assert.equal(headingFromXZ(0,1),0);assert.equal(headingFromXZ(1,0),90);
assert.equal(headingFromXZ(0,-1),180);assert.equal(headingFromXZ(-1,0),270);
assert.equal(aircraftHeading({x:0,y:0,z:0,w:1}),0);
assert.equal(shortestHeadingDelta(359,1),2);assert.equal(shortestHeadingDelta(1,359),-2);
assert.equal(headingFromXZ(0,0,42),42);

const changing=new Atmosphere('light'),prior=changing.wind.clone();
changing.set({fromDeg:90,speedMps:9});changing.sample(dt,dt);
assert.ok(changing.wind.distanceTo(prior)<.1,'settings begin without an airflow jump');
for(let i=2;i<=360;i++)changing.sample(i*dt,dt);
assert.ok(changing.mean.x<0,'wind FROM east flows west');
changing.set({preset:'off'});assert.equal(changing.wind.length(),0,'Off clears effects immediately');
assert.equal(changing.angular.roll,0);

let downloaded;
const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
URL.createObjectURL=b=>{downloaded=b;return 'blob:weather'};URL.revokeObjectURL=()=>{};
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,classList:{toggle(){}},click(){}});return elements.get(id)};
globalThis.document={hidden:false,createElement:()=>({click(){}})};
const weather=new Atmosphere('light',12345),sim=new Flight('bush',weather);
const recorder=createRecorder({sim,keys:new Set(),renderer:{info:{render:{calls:0,triangles:0}}},ground,$,isPaused:()=>false});
recorder.startRecording();
for(let i=0;i<25;i++){sim.step(dt);recorder.recordTick(false,dt)}
const before=weather.set({fromDeg:180});recorder.queueAtmosphereChange(before);
for(let i=0;i<25;i++){sim.step(dt);recorder.recordTick(false,dt)}
recorder.stopRecording();recorder.exportRecording();
const json=JSON.parse(await downloaded.text());
assert.equal(json.initialConfiguration.atmosphere.preset,'light');assert.equal(json.initialConfiguration.atmosphere.seed,12345);
assert.equal(json.samples.length,4);assert.equal(json.samples[0].atmosphere.windFromDeg,270);
assert.equal(json.samples.at(-1).atmosphere.windFromDeg,180);
assert.equal(json.events.filter(e=>e.type==='atmosphere_changed').length,1);
assert.equal(json.events.find(e=>e.type==='atmosphere_changed').newConfiguration.fromDeg,180);
assert.ok(json.samples.every(s=>Number.isFinite(s.airspeedMps)&&Number.isFinite(s.groundspeedMps)));
assert.ok(json.summary?.stallDiagnosticsSummary);
URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
console.log('atmosphere: Off equivalence, wind drift, smooth seeded gusts, heading and recorder passed');
