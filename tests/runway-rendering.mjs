import assert from 'node:assert/strict';
import {RUNWAY,RUNWAY_ASPHALT_DEPTH_BIAS,runwayContains} from '../src/world/runway.js';
import {ground} from '../src/world/height.js';

assert.equal(RUNWAY.elevationM,100);
assert.equal(RUNWAY.lengthM,1200);
assert.equal(RUNWAY.widthM,40);
assert.deepEqual(RUNWAY_ASPHALT_DEPTH_BIAS,{polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-1});
for(const x of [-20,0,20])for(const z of [-600,0,600]){
 assert.equal(runwayContains(RUNWAY.x+x,RUNWAY.z+z),true);
 assert.ok(Math.abs(ground(RUNWAY.x+x,RUNWAY.z+z)-RUNWAY.elevationM)<1e-8,'authoritative runway contact height is unchanged');
}
assert.equal(runwayContains(RUNWAY.x+20.01,RUNWAY.z),false);
console.log('runway depth bias is bounded; runway geometry dimensions and authoritative contact heights are unchanged');
