import assert from 'node:assert/strict';
import {Euler} from '../src/vendor/three.js';
import {Flight} from '../src/physics/Flight.js';
import {Atmosphere} from '../src/physics/atmosphere.js';
import {ground,terrain} from '../src/world/height.js';
import {RUNWAY,TARMAC} from '../src/world/runway.js';
import {aircraftHeading,shortestHeadingDelta} from '../src/rendering/heading.js';
import {createRecorder} from '../src/telemetry/recorder.js';
const dt=1/120;
function make(preset='off',settings={}){const a=new Atmosphere(preset,17391,terrain);a.set(settings);const f=new Flight('bush',a);f.reset('runway');return f}
function run(f,seconds,input={},observe=()=>{}){for(let i=0;i<Math.round(seconds/dt);i++){assert.equal(f.step(dt,input),false,'unexpected crash/reset');assert.ok(Number.isFinite(f.p.lengthSq()+f.v.lengthSq()+f.q.lengthSq()+f.w.lengthSq()));observe(f)}}
const speed=f=>Math.hypot(f.v.x,f.v.z),physical=f=>[...f.p.toArray(),...f.v.toArray(),...f.q.toArray(),...f.w.toArray(),f.throttle,f.stall];
for(const dx of [-20,0,20])for(const dz of [-600,0,600])assert.ok(Math.abs(ground(RUNWAY.x+dx,RUNWAY.z+dz)-RUNWAY.elevationM)<1e-8,'shared mesh is level across pavement');
const rest=make(),start=rest.p.clone(),q0=rest.q.clone();assert.equal(rest.throttle,0);assert.equal(rest.groundState.wheelsContacting,3);assert.ok(rest.terrainCollision.clearance(rest.p,rest.q,true)>0);
run(rest,60);assert.ok(rest.p.distanceTo(start)<.002);assert.ok(rest.q.angleTo(q0)<.001);assert.ok(speed(rest)<.001);assert.ok(Math.abs(rest.groundState.supportRatio-1)<.001);
const idle=make();idle.throttle=.05;run(idle,30);assert.ok(speed(idle)<.01,'sub-resistance thrust can rest without a velocity reset');
const low=make(),high=make();low.throttle=.2;high.throttle=.4;run(low,30);run(high,30);assert.ok(speed(high)>speed(low)*1.5&&speed(low)>2);
assert.ok(Math.abs(low.groundState.rollingResistanceN-TARMAC.rollingResistance*low.groundState.normalForceN)<.1);assert.ok(high.groundState.normalForceN<low.groundState.normalForceN,'higher aerodynamic lift unloads wheels');
const coast=make();coast.v.z=6;let minForward=Infinity;run(coast,40,{},f=>{minForward=Math.min(minForward,f.v.z)});assert.ok(speed(coast)<.02&&minForward>-.005,'rolling resistance stops without reversing');
const headings=[];for(const yaw of [-1,1]){const f=make();f.v.z=3;f.throttle=.12;run(f,3,{yaw});headings.push(shortestHeadingDelta(0,aircraftHeading(f.q)));assert.ok(Math.abs(new Euler().setFromQuaternion(f.q,'YXZ').z)<.1)}
assert.ok(headings[0]>5&&headings[1]<-5);assert.ok(Math.abs(headings[0]+headings[1])<.01);
const stationarySteer=make(),steerStart=stationarySteer.p.clone();run(stationarySteer,10,{yaw:1});assert.ok(stationarySteer.p.distanceTo(steerStart)<.01);assert.ok(Math.abs(shortestHeadingDelta(0,aircraftHeading(stationarySteer.q)))<.05,'steering does not spin in place');
const fastSteer=make();fastSteer.v.z=12;run(fastSteer,1,{yaw:1});assert.ok(Math.abs(fastSteer.groundState.steerAngleDeg)<12,'tailwheel angle reduces at speed');
const brake=make(),brakeZ=brake.p.z;brake.v.z=8;let stopSec=null,maxBrake=0,minBrakeSpeed=Infinity,maxBrakeZ=brakeZ;
run(brake,3,{brake:1},f=>{if(stopSec===null&&speed(f)<.05)stopSec=f.time;maxBrake=Math.max(maxBrake,f.groundState.brakingForceN);minBrakeSpeed=Math.min(minBrakeSpeed,f.v.z);maxBrakeZ=Math.max(maxBrakeZ,f.p.z)});
assert.ok(stopSec<3&&speed(brake)<.01&&minBrakeSpeed>-.05&&maxBrake>1000&&maxBrakeZ-brake.p.z<.02);
for(const startSpeed of [5,12,15]){const f=make();f.v.z=startSpeed;let peak=0,sum=0,load=0,count=0,lost=0,missing=0,stop=null;
 run(f,5,{brake:1},v=>{if(stop!==null)return;const g=v.groundState;peak=Math.max(peak,g.brakingForceN);sum+=g.brakingForceN;load+=g.normalForceN;count++;lost+=!g.contact;missing+=g.brakeInput!==1;if(stop===null&&speed(v)<.05)stop=v.time});
 assert.ok(stop!==null&&lost===0&&missing===0&&peak>2500&&sum/count>2000&&load/count>5000,`brake contact/load at ${startSpeed} m/s`);
}
const unbraked=make();unbraked.v.z=12;run(unbraked,5);assert.ok(speed(unbraked)>9);
const powerBrake=make();powerBrake.v.z=12;powerBrake.throttle=1;run(powerBrake,5,{brake:1});assert.ok(speed(powerBrake)<3);
const cross=make('light',{speedMps:8,fromDeg:270,intensity:0});cross.v.z=5;cross.throttle=.2;run(cross,10);assert.ok(Math.abs(cross.p.x-RUNWAY.x)<5);assert.ok(Math.abs(shortestHeadingDelta(0,aircraftHeading(cross.q)))>1,'crosswind has a directional influence');
const windyPark=make('light'),windyStart=windyPark.p.clone();run(windyPark,60,{brake:1});assert.ok(windyPark.p.distanceTo(windyStart)<.02);
const head=make('light',{speedMps:6,fromDeg:0,intensity:0}),tail=make('light',{speedMps:6,fromDeg:180,intensity:0});head.v.z=6;tail.v.z=6;run(head,dt);run(tail,dt);assert.ok(head.airVelocity.length()>tail.airVelocity.length()+8);
// Record an acceleration and naturally emerging liftoff. Raw contact may briefly
// flutter near zero load; transition events confirm stable state without changing forces.
const roll=make();roll.throttle=1;const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{classList:{toggle(){}}});return nodes.get(id)};
const rec=createRecorder({sim:roll,keys:new Set(),renderer:{info:{render:{calls:0,triangles:0}}},ground,$,isPaused:()=>false});rec.startRecording();
let firstAir=null,minSupport=1;run(roll,40,{},f=>{rec.recordTick(false,dt);minSupport=Math.min(minSupport,f.groundState.supportRatio);if(firstAir===null&&!f.groundState.contact)firstAir={timeSec:f.time,groundspeedMps:speed(f),distanceM:f.p.z-start.z}});rec.stopRecording();
assert.ok(minSupport<.1&&firstAir);assert.equal(roll.groundState.contact,false);assert.equal(roll.groundState.normalForceN,0);
const data=JSON.parse(JSON.stringify(rec.recorder.data));assert.ok(data.summary);assert.equal(data.initialConfiguration.startMode,'runway');assert.equal(data.initialConfiguration.groundHandling.surface.id,'tarmac');assert.ok(data.samples.some(s=>s.groundHandling.supportRatio<.5&&s.groundHandling.contact));assert.equal(data.events.filter(e=>e.type==='wheel_contact_exit').length,1);assert.equal(data.events.filter(e=>e.type==='ground_contact').length,0);assert.ok(data.samples.every(s=>!('wheels' in s.groundHandling)));
const airA=new Flight('bush',new Atmosphere('off')),airB=new Flight('bush',new Atmosphere('off'));run(airA,5);run(airB,5,{brake:1});assert.deepEqual(physical(airA),physical(airB));assert.equal(airB.groundState.brakingForceN,0);
const outside=make();outside.p.x=RUNWAY.x+RUNWAY.widthM/2+5;outside.v.z=3;run(outside,2);assert.equal(outside.groundState.contact,true);assert.equal(outside.groundState.surface,'dry-land');assert.equal(outside.lastImpact,null);assert.ok(outside.groundState.brakingForceN===0);
const hard=make();hard.v.y=-5;assert.equal(hard.step(dt),true);assert.equal(hard.lastImpact.reason,'hard_gear_contact');
const wet=make();wet.p.set(0,20,0);assert.equal(wet.step(dt),true);assert.equal(wet.lastImpact.surface,'water');
outside.reset('airborne');assert.equal(outside.startMode,'airborne');assert.equal(outside.p.x,-1200);assert.equal(outside.groundState.contact,false);
const fighter=new Flight('fighter');fighter.reset('runway');assert.equal(fighter.startMode,'airborne');assert.equal(fighter.groundState.contact,false);
console.log('ground: level runway, rest, thrust, braking, steering, crosswind, liftoff, dry land/water/hard contact, resets and recorder passed');
console.log({restDriftM:rest.p.distanceTo(start),speedAt30SecMps:{throttle20:speed(low),throttle40:speed(high)},steeringAfter3SecDeg:headings,brakingFrom8Mps:{stopSec,distanceM:brake.p.z-brakeZ,settlingRollbackM:maxBrakeZ-brake.p.z},crosswind8Mps:{crossTrackM:cross.p.x-RUNWAY.x,headingDeg:shortestHeadingDelta(0,aircraftHeading(cross.q))},firstNaturalLiftoff:firstAir});
