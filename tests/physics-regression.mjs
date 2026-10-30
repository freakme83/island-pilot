// Numeric snapshots from the single-file main commit; no test dependency or build step.
import {readFileSync} from 'node:fs';
import {Flight} from '../src/physics/Flight.js';
const fixture=JSON.parse(readFileSync(new URL('./physics-fixture.json',import.meta.url)));
function state(s){return {position:s.p.toArray(),velocity:s.v.toArray(),orientation:s.q.toArray(),angularVelocity:s.w.toArray(),stall:s.stall,trim:s.trim,throttle:s.throttle,cl:s.diagnostics.cl,cd:s.diagnostics.cd,authority:s.diagnostics.authority}}
function compare(actual,expected,label){for(const key of Object.keys(expected)){const a=actual[key],b=expected[key];for(let n=0;n<(Array.isArray(b)?b.length:1);n++){const x=Array.isArray(a)?a[n]:a,y=Array.isArray(b)?b[n]:b;if(Math.abs(x-y)>1e-10)throw Error(`${label}.${key}[${n}]: ${x} != ${y}`)}}}
for(const id of ['bush','fighter']){
 const flight=new Flight(id),snapshots=fixture.profiles[id];compare(state(flight),snapshots[0].state,`${id} initial`);
 for(let i=0;i<2400;i++){
  if(i===800)flight.tuning.drag=1.15;
  if(i===1600)flight.reset();
  const input=i<400?{}:i<800?{throttle:1,pitch:-.3}:i<1200?{throttle:-1,pitch:1,roll:.6,yaw:.2}:i<1800?{pitch:-1,roll:-.5}:{};
  flight.step(fixture.physicsTimestepSec,input);
  const expected=snapshots.find(s=>s.step===i+1);if(expected)compare(state(flight),expected.state,`${id} step ${i+1}`);
 }
 console.log(`${id}: ${snapshots.length} exact-state checkpoints matched main`);
}
