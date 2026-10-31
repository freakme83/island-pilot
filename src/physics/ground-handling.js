import {Vector3} from '../vendor/three.js';
import {ground,WATER_LEVEL_M} from '../world/height.js';
import {RUNWAY,TARMAC,surfaceAt} from '../world/runway.js';

// Measured bottom points in the leveled GLB's flight-pivot coordinates. Taildragger.
export const BUSH_WHEELS=Object.freeze([[-1.2,-1.81805,1.39844],[1.2,-1.81805,1.39844],[0,-.72510,-3.95156]]);
export const groundTuning=Object.freeze({springNPerM:70000,damperNsPerM:7600,maxCompressionM:.18,maxContactDescentMps:3,tailSteerRad:.61,lateralRelaxationSec:.09,frictionIterations:6});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export class GroundHandling {
 constructor(){
  this.force=new Vector3();this.acceleration=new Vector3();this.worldOmega=new Vector3();this.pointVelocity=new Vector3();this.cross=new Vector3();this.torque=new Vector3();this.localTorque=new Vector3();this.axis=new Vector3();
  this.wheels=BUSH_WHEELS.map((p,i)=>({offset:new Vector3(...p),arm:new Vector3(),position:new Vector3(),forward:new Vector3(),side:new Vector3(),load:0,material:null,longJ:0,sideJ:0,tail:i===2}));
  this.state={contact:false,wheelsContacting:0,normalForceN:0,supportRatio:0,rollingResistanceN:0,brakingForceN:0,lateralTireForceN:0,steeringInput:0,brakeInput:0,steerAngleDeg:0,surface:null,status:'AIRBORNE'};
  this.steerAngle=0;this.impact=null;
 }
 clear(){Object.assign(this.state,{contact:false,wheelsContacting:0,normalForceN:0,supportRatio:0,rollingResistanceN:0,brakingForceN:0,lateralTireForceN:0,steeringInput:0,brakeInput:0,steerAngleDeg:0,surface:null,status:'AIRBORNE'});this.force.set(0,0,0);this.acceleration.set(0,0,0);this.steerAngle=0;this.impact=null;for(const w of this.wheels){w.load=0;w.material=null;w.longJ=0;w.sideJ=0}}
 spawn(sim){
  const k=groundTuning.springNPerM,weight=sim.massKg*9.81;
  // Solve static three-spring height and pitch. No per-frame height snapping.
  const balance=angle=>{let sumY=0;for(const w of this.wheels)sumY+=w.offset.y*Math.cos(angle)-w.offset.z*Math.sin(angle);const height=-(weight/k+sumY)/3;let moment=0;for(const w of this.wheels){const y=w.offset.y*Math.cos(angle)-w.offset.z*Math.sin(angle),z=w.offset.y*Math.sin(angle)+w.offset.z*Math.cos(angle);moment+=z*k*(-height-y)}return {height,moment}};
  let lo=-.35,hi=-.1;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(balance(mid).moment<0)lo=mid;else hi=mid}
  const angle=(lo+hi)/2,height=balance(angle).height;
  sim.q.setFromAxisAngle(this.axis.set(1,0,0),angle);sim.p.set(RUNWAY.x,RUNWAY.elevationM+height,RUNWAY.z-RUNWAY.lengthM/2+100);sim.v.set(0,0,0);sim.w.set(0,0,0);sim.throttle=0;
  sim.f.set(0,0,1).applyQuaternion(sim.q);sim.u.set(0,1,0).applyQuaternion(sim.q);sim.x.set(1,0,0).applyQuaternion(sim.q);sim.inv.copy(sim.q).invert();
  this.sample(sim,1/120,{});
 }
 sample(sim,dt,controls){
  const s=this.state,t=groundTuning;s.contact=false;s.wheelsContacting=0;s.normalForceN=0;s.supportRatio=0;s.rollingResistanceN=0;s.brakingForceN=0;s.lateralTireForceN=0;s.surface=null;s.status='AIRBORNE';s.steeringInput=sim.input.yaw;s.brakeInput=controls.brake?1:0;
  this.force.set(0,0,0);this.torque.set(0,0,0);this.acceleration.set(0,0,0);this.impact=null;
  if(sim.profileId!=='bush')return false;
  const speed=Math.hypot(sim.v.x,sim.v.z),target=sim.input.yaw*t.tailSteerRad/(1+(speed/6)**2);this.steerAngle+=(target-this.steerAngle)*(1-Math.exp(-dt*6));s.steerAngleDeg=this.steerAngle*180/Math.PI;
  this.worldOmega.copy(sim.w).applyQuaternion(sim.q);
  for(const w of this.wheels){
   w.load=0;w.longJ=0;w.sideJ=0;w.arm.copy(w.offset).applyQuaternion(sim.q);w.position.copy(sim.p).add(w.arm);w.material=surfaceAt(w.position.x,w.position.z)||TARMAC;
   const terrainHeight=ground(w.position.x,w.position.z),water=terrainHeight<=WATER_LEVEL_M;
   const height=Math.max(WATER_LEVEL_M,terrainHeight),compression=height-w.position.y;
   this.pointVelocity.crossVectors(this.worldOmega,w.arm).add(sim.v);
   if(compression>=0){
    if(water||compression>t.maxCompressionM||this.pointVelocity.y < -t.maxContactDescentMps){
     if(!this.impact)this.impact={positionM:sim.p.toArray(),velocityMps:sim.v.toArray(),contactPositionM:[w.position.x,height,w.position.z],terrainHeightM:terrainHeight,surfaceHeightM:height,surface:water?'water':'terrain',proxy:w.tail?'tailwheel':'main wheel',reason:water?'water_contact':'hard_gear_contact',sweepFraction:0};continue;
    }
    w.load=Math.max(0,t.springNPerM*compression-t.damperNsPerM*this.pointVelocity.y);
   }
   if(w.load>1){s.wheelsContacting++;s.normalForceN+=w.load;this.force.y+=w.load;this.cross.set(0,w.load,0);this.torque.add(this.localTorque.crossVectors(w.arm,this.cross));}
   const angle=w.tail?this.steerAngle:0;w.forward.set(Math.sin(angle),0,Math.cos(angle)).applyQuaternion(sim.q);w.forward.y=0;w.forward.normalize();w.side.set(w.forward.z,0,-w.forward.x);
  }
  s.contact=s.wheelsContacting>0;s.supportRatio=s.normalForceN/(sim.massKg*9.81);s.surface=s.contact?(this.wheels.some(w=>w.load>1&&!surfaceAt(w.position.x,w.position.z))?'dry-land':'tarmac'):null;s.status=s.contact?(speed<.3?'STATIONARY':speed<8?'TAXI':'GROUND ROLL'):'AIRBORNE';
  if(s.contact){const i=sim.airflowResponse.diagnostics;this.localTorque.copy(this.torque).applyQuaternion(sim.inv);this.acceleration.set(this.localTorque.x/i.pitchInertiaKgM2,this.localTorque.y/i.yawInertiaKgM2,this.localTorque.z/i.rollInertiaKgM2)}
  return s.contact;
 }
 effectiveInverseMass(sim,w,direction){
  const i=sim.airflowResponse.diagnostics;this.localTorque.crossVectors(w.arm,direction).applyQuaternion(sim.inv);
  return 1/sim.massKg+this.localTorque.x**2/i.pitchInertiaKgM2+this.localTorque.y**2/i.yawInertiaKgM2+this.localTorque.z**2/i.rollInertiaKgM2;
 }
 velocityAlong(sim,w,direction){this.worldOmega.copy(sim.w).applyQuaternion(sim.q);return this.pointVelocity.crossVectors(this.worldOmega,w.arm).add(sim.v).dot(direction)}
 impulse(sim,w,direction,j){
  sim.v.addScaledVector(direction,j/sim.massKg);this.localTorque.crossVectors(w.arm,direction).applyQuaternion(sim.inv).multiplyScalar(j);const i=sim.airflowResponse.diagnostics;
  sim.w.x+=this.localTorque.x/i.pitchInertiaKgM2;sim.w.y+=this.localTorque.y/i.yawInertiaKgM2;sim.w.z+=this.localTorque.z/i.rollInertiaKgM2;
 }
 solveFriction(sim,dt){
  const s=this.state,t=groundTuning,tau=t.lateralRelaxationSec*smooth(.2,2,Math.hypot(sim.v.x,sim.v.z));
  for(let pass=0;pass<t.frictionIterations;pass++)for(const w of this.wheels){
   if(w.load<=1)continue;const m=w.material,longLimit=(m.rollingResistance+s.brakeInput*m.brakingGrip)*w.load*dt;
   let inverse=this.effectiveInverseMass(sim,w,w.forward),j=-this.velocityAlong(sim,w,w.forward)/inverse,next=clamp(w.longJ+j,-longLimit,longLimit);this.impulse(sim,w,w.forward,next-w.longJ);w.longJ=next;
   const grip=m.lateralGrip*w.load*dt,sideLimit=Math.sqrt(Math.max(0,grip*grip-w.longJ*w.longJ));inverse=this.effectiveInverseMass(sim,w,w.side);const softness=inverse*tau/dt;
   j=-(this.velocityAlong(sim,w,w.side)+softness*w.sideJ)/(inverse+softness);next=clamp(w.sideJ+j,-sideLimit,sideLimit);this.impulse(sim,w,w.side,next-w.sideJ);w.sideJ=next;
  }
  for(const w of this.wheels)if(w.load>1){const rolling=Math.min(Math.abs(w.longJ),w.material.rollingResistance*w.load*dt);s.rollingResistanceN+=rolling/dt;s.brakingForceN+=(Math.abs(w.longJ)-rolling)/dt;s.lateralTireForceN+=Math.abs(w.sideJ)/dt}
 }
}
