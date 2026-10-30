import {Vector3} from '../vendor/three.js';
import {createConditions} from './atmosphere.js';

// Approximate gameplay dimensions, independent of GLB meshes. No geometry analysis.
export const airframeDimensions=Object.freeze({
 bush:{spanM:11.8,lengthM:8.2,tailArmM:4.1,inertiaScale:1},
 fighter:{spanM:9.4,lengthM:10.2,tailArmM:4.8,inertiaScale:1.8}
});
export const airflowResponseTuning=Object.freeze({
 wingSampleSpanFraction:.35,tailAreaFraction:.18,tailSideAreaFraction:.20,
 rollInertiaFactor:.06,pitchInertiaFactor:.10,yawInertiaFactor:.12,
 wingCoupling:.22,tailCoupling:.28,yawCoupling:.5,
 maxRollAcceleration:.5,maxPitchAcceleration:.24,maxYawAcceleration:.12
});
const bounded=(value,limit)=>limit*Math.tanh(value/limit);
export class AirflowResponse {
 constructor(){
  this.leftPosition=new Vector3();this.rightPosition=new Vector3();this.tailPosition=new Vector3();
  this.left=createConditions();this.right=createConditions();this.tail=createConditions();this.delta=new Vector3();
  this.diagnostics={pitchRadPerSec2:0,rollRadPerSec2:0,yawRadPerSec2:0,wingUpflowDifferenceMps:0,tailUpflowDifferenceMps:0,tailCrossflowDifferenceMps:0,effectiveMassKg:0,inertiaScale:1,rollInertiaKgM2:0,pitchInertiaKgM2:0,yawInertiaKgM2:0};
 }
 clear(sim){
  const d=this.diagnostics,g=airframeDimensions[sim.profileId],t=airflowResponseTuning,m=sim.massKg*g.inertiaScale;
  d.pitchRadPerSec2=0;d.rollRadPerSec2=0;d.yawRadPerSec2=0;d.wingUpflowDifferenceMps=0;d.tailUpflowDifferenceMps=0;d.tailCrossflowDifferenceMps=0;
  d.effectiveMassKg=sim.massKg;d.inertiaScale=g.inertiaScale;d.rollInertiaKgM2=m*g.spanM*g.spanM*t.rollInertiaFactor;d.pitchInertiaKgM2=m*g.lengthM*g.lengthM*t.pitchInertiaFactor;d.yawInertiaKgM2=m*g.lengthM*g.lengthM*t.yawInertiaFactor;
 }
 update(sim,speed){
  this.clear(sim);const a=sim.atmosphere,d=this.diagnostics,t=airflowResponseTuning,g=airframeDimensions[sim.profileId],p=sim.profile,arm=g.spanM*t.wingSampleSpanFraction;
  this.leftPosition.set(-arm,0,0).applyQuaternion(sim.q).add(sim.p);this.rightPosition.set(arm,0,0).applyQuaternion(sim.q).add(sim.p);this.tailPosition.set(0,0,-g.tailArmM).applyQuaternion(sim.q).add(sim.p);
  a.sample(this.leftPosition,sim.time,this.left);a.sample(this.rightPosition,sim.time,this.right);a.sample(this.tailPosition,sim.time,this.tail);
  d.wingUpflowDifferenceMps=this.delta.copy(this.right.wind).sub(this.left.wind).dot(sim.u);
  this.delta.copy(this.tail.wind).sub(a.wind);d.tailUpflowDifferenceMps=this.delta.dot(sim.u);d.tailCrossflowDifferenceMps=this.delta.dot(sim.x);
  // dL/d(upflow) ~= 0.5 rho V S liftSlope. Only differences produce moments;
  // the mean force is already accounted for by the center aerodynamic calculation.
  const liftSensitivity=.5*p.rho*speed*p.area*p.slope*sim.tuning.lift*Math.max(.15,1-sim.stall),scale=sim.turbulenceResponse;
  d.rollRadPerSec2=bounded(scale*liftSensitivity*.5*d.wingUpflowDifferenceMps*arm*t.wingCoupling/d.rollInertiaKgM2,t.maxRollAcceleration);
  d.pitchRadPerSec2=bounded(scale*liftSensitivity*t.tailAreaFraction*d.tailUpflowDifferenceMps*g.tailArmM*t.tailCoupling/d.pitchInertiaKgM2,t.maxPitchAcceleration);
  d.yawRadPerSec2=bounded(-scale*.5*p.rho*speed*p.area*p.sideForce*t.tailSideAreaFraction*d.tailCrossflowDifferenceMps*g.tailArmM*t.yawCoupling/d.yawInertiaKgM2,t.maxYawAcceleration);
 }
}
