import assert from 'node:assert/strict';
import {Flight} from '../src/physics/Flight.js';
import {Atmosphere,createConditions} from '../src/physics/atmosphere.js';
import {Euler,Vector3} from '../src/vendor/three.js';
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

function trace(){const weather=new Atmosphere('light',223344),f=new Flight('bush',weather),out=[],previous=weather.wind.clone();for(let i=0;i<3600;i++){
 f.step(dt,i>1200&&i<1400?{roll:.12}:{});
 assert.ok(weather.wind.distanceTo(previous)<.5,'gusts remain continuous at 120 Hz');previous.copy(weather.wind);
 if(i%60===0)out.push(state(f));
 }return out}
assert.deepEqual(trace(),trace(),'identical seed and controls replay the same trajectory');
assert.notDeepEqual(trace()[30],state(new Flight('bush',new Atmosphere('off'))),'light conditions disturb flight');

assert.equal(headingFromXZ(0,1),0);assert.equal(headingFromXZ(1,0),90);
assert.equal(headingFromXZ(0,-1),180);assert.equal(headingFromXZ(-1,0),270);
assert.equal(aircraftHeading({x:0,y:0,z:0,w:1}),0);
assert.equal(shortestHeadingDelta(359,1),2);assert.equal(shortestHeadingDelta(1,359),-2);
assert.equal(headingFromXZ(0,0,42),42);

const changing=new Atmosphere('light'),position=new Vector3(30,250,-17),prior=changing.wind.clone();
changing.set({fromDeg:90,speedMps:9});changing.update(new Vector3(),dt,dt);
assert.ok(changing.wind.distanceTo(prior)<.1,'settings begin without an airflow jump');
for(let i=2;i<=360;i++)changing.update(new Vector3(),i*dt,dt);
assert.ok(changing.mean.x<0,'wind FROM east flows west');
changing.set({preset:'off'});assert.equal(changing.wind.length(),0,'Off clears effects immediately');
assert.equal(changing.gust.length(),0);

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
assert.equal(json.initialConfiguration.atmosphere.modelVersion,'2.2');
assert.equal(json.samples[0].airflowResponse.effectiveMassKg,720);
assert.ok(Number.isFinite(json.samples[0].airflowResponse.rollRadPerSec2));
assert.ok(json.samples[0].atmosphere.localTurbulenceMagnitudeMps>0);
const withFields=JSON.parse(JSON.stringify(json));assert.ok(withFields.atmosphereConventions.airflowResponse.includes('rad/s^2'));
URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;


// Multiple queries cannot advance transitions, move the field, or overwrite center telemetry.
const field=new Atmosphere('light'),c1=createConditions(),c2=createConditions();
const centerWind=field.wind.clone();
field.sample(position,5,c1);field.sample(position,5,c2);assert.deepEqual(c1.wind.toArray(),c2.wind.toArray());
assert.deepEqual(field.wind.toArray(),centerWind.toArray());
field.sample(new Vector3(position.x+50,position.y,position.z),5,c2);assert.ok(c1.wind.distanceTo(c2.wind)>.01,'X/Z affects field');
field.sample(new Vector3(position.x,position.y+50,position.z),5,c2);assert.ok(c1.wind.distanceTo(c2.wind)>.01,'altitude affects field');
for(const x of [-48,-24,0,24,48]){
 field.sample(new Vector3(x-1e-5,200,17),5,c1);field.sample(new Vector3(x+1e-5,200,17),5,c2);
 assert.ok(c1.wind.distanceTo(c2.wind)<1e-4,'no noise-cell boundary discontinuity');
}
field.sample(position,5,c1);field.sample(position,5.00001,c2);assert.ok(c1.wind.distanceTo(c2.wind)<1e-4);
// Settings at a late time must not rephase the field by multiplying new speed by all past time.
field.update(position,1000,dt);const lateWind=field.wind.clone();field.set({speedMps:12,fromDeg:30});field.update(position,1000+dt,dt);
assert.ok(field.wind.distanceTo(lateWind)<.1);
const low=new Atmosphere('light'),high=new Atmosphere('light');low.set({intensity:.2});high.set({intensity:1.2});low.reset();high.reset();
let lowSq=0,highSq=0;
for(let i=0;i<100;i++){position.set(i*7,200+i,-i*3);low.sample(position,10,c1);high.sample(position,10,c2);lowSq+=c1.gust.lengthSq();highSq+=c2.gust.lengthSq()}
assert.ok(Math.sqrt(highSq/lowSq)>5,'intensity measurably increases the same environmental field');

// A synthetic upward gradient gives a correctly signed pure roll moment;
// more speed increases loading, while more mass/inertia reduces angular response.
const gradientFlight=new Flight('bush',new Atmosphere('light'));
gradientFlight.atmosphere.sample=(p,t,out)=>{out.wind.set(0,p.x*.01,0);return out};
gradientFlight.atmosphere.wind.set(0,gradientFlight.p.x*.01,0);
gradientFlight.f.set(0,0,1).applyQuaternion(gradientFlight.q);gradientFlight.u.set(0,1,0).applyQuaternion(gradientFlight.q);gradientFlight.x.set(1,0,0).applyQuaternion(gradientFlight.q);
gradientFlight.airflowResponse.update(gradientFlight,30);const roll30=gradientFlight.airflowResponse.diagnostics.rollRadPerSec2;assert.ok(roll30>0);
gradientFlight.airflowResponse.update(gradientFlight,60);assert.ok(gradientFlight.airflowResponse.diagnostics.rollRadPerSec2>roll30);
Object.defineProperty(gradientFlight,'massKg',{value:1440});gradientFlight.airflowResponse.update(gradientFlight,30);assert.ok(gradientFlight.airflowResponse.diagnostics.rollRadPerSec2<roll30);

// 60 seconds, no controls, same world position, orientation, throttle, and ground velocity.
function handsOff(profile,preset){
 const atmosphere=new Atmosphere(preset),s=new Flight(profile,atmosphere),e=new Euler(),y0=s.p.y;
 s.v.set(0,0,s.profile.cruise);e.setFromQuaternion(s.q,'YXZ');const pitch0=e.x*180/Math.PI;
 let maxRoll=0,sumRoll=0,minPitch=Infinity,maxPitch=-Infinity,maxHeading=0,maxAltitude=0,gustSq=0,maxEffect=0,resets=0;
 for(let i=0;i<7200;i++){
  resets+=s.step(dt)?1:0;assert.ok(Number.isFinite(s.p.lengthSq()+s.v.lengthSq()+s.w.lengthSq()+s.q.lengthSq()));
  e.setFromQuaternion(s.q,'YXZ');const roll=e.z*180/Math.PI,pitch=e.x*180/Math.PI-pitch0;
  maxRoll=Math.max(maxRoll,Math.abs(roll));sumRoll+=roll*roll;minPitch=Math.min(minPitch,pitch);maxPitch=Math.max(maxPitch,pitch);
  maxHeading=Math.max(maxHeading,Math.abs(shortestHeadingDelta(0,aircraftHeading(s.q))));maxAltitude=Math.max(maxAltitude,Math.abs(s.p.y-y0));gustSq+=atmosphere.gust.lengthSq();maxEffect=Math.max(maxEffect,s.stall);
 }
 assert.equal(resets,0,'normal cruise needs no automatic resets');assert.ok(maxEffect<.1,'normal cruise stays out of stall effects');
 return {profile,preset,maxRollDeg:maxRoll,rmsRollDeg:Math.sqrt(sumRoll/7200),pitchRangeDeg:maxPitch-minPitch,maxHeadingDeviationDeg:maxHeading,maxAltitudeDeviationM:maxAltitude,gustRmsMps:Math.sqrt(gustSq/7200)};
}
const results=[];
for(const profile of ['bush','fighter'])for(const preset of ['off','light','breezy'])results.push(handsOff(profile,preset));
const bushLight=results.find(r=>r.profile==='bush'&&r.preset==='light'),bushBreezy=results.find(r=>r.profile==='bush'&&r.preset==='breezy');
assert.ok(bushLight.maxRollDeg>1,'Light has a measurable attitude disturbance');
assert.ok(bushBreezy.gustRmsMps>bushLight.gustRmsMps*1.2);
assert.ok(bushBreezy.pitchRangeDeg>bushLight.pitchRangeDeg);
console.table(results.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='number'?Number(v.toFixed(2)):v]))));
console.log('atmosphere v2.1: Off equality, steady drift, continuous spatial field, repeatability, intensity, mass/speed response, heading and recorder passed. Numerical response is not a hands-on feel verdict.');
