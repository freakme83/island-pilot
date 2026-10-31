import {Vector3,Quaternion} from '../vendor/three.js';
import {defaults,profiles} from '../config/profiles.js';
import {ground,baseGround} from '../world/height.js';
import {AirflowResponse} from './airflow-response.js';
import {TerrainCollision} from './terrain-collision.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function engineAt(p,speed){return p.engine/(1+Math.max(0,speed-p.fadeStart)*p.fadeRate);}

export class Flight {
 constructor(profileId="bush",atmosphere=null){this.atmosphere=atmosphere;this.airVelocity=new Vector3();this.airflowResponse=new AirflowResponse();this.terrainCollision=new TerrainCollision();this.lastImpact=null;this.turbulenceResponse=1;this.profileId=profileId;this.profile=profiles[profileId];this.tunings={bush:{...defaults},fighter:{...defaults}};this.tuning=this.tunings[profileId];this.p=new Vector3();this.v=new Vector3();this.q=new Quaternion();this.w=new Vector3();this.input={pitch:0,roll:0,yaw:0};this.diagnostics={};this.f=new Vector3();this.u=new Vector3();this.x=new Vector3();this.local=new Vector3();this.dir=new Vector3();this.liftDir=new Vector3();this.force=new Vector3();this.dq=new Quaternion();this.inv=new Quaternion();this.reset();}
 // Single mass source for forces and approximate atmospheric inertia; future cargo can extend it.
 get massKg(){return this.profile.mass}
 selectProfile(id){if(!profiles[id])return;this.profileId=id;this.profile=profiles[id];this.tuning=this.tunings[id];this.reset();}
 restoreDefaults(){Object.assign(this.tuning,defaults);this.reset();}
 reset(){
  this.lastImpact=null;
  const p=this.profile,t=this.tuning,mass=this.massKg;
  // Preserve the original world spawn; the shared surface still enforces safe clearance.
  this.p.set(-1200,Math.max(baseGround(-1200,0)+p.startHeight,ground(-1200,0)+25),0);this.v.set(0,0,p.cruise);this.w.set(0,0,0);this.input={pitch:0,roll:0,yaw:0};this.stall=0;this.alpha=0;this.time=0;this.resets=0;
  if(this.atmosphere?.enabled){this.atmosphere.reset(this.p);this.v.add(this.atmosphere.wind)}
  else this.atmosphere?.reset(this.p);
  this.airflowResponse.clear(this);
  this.airVelocity.copy(this.v);if(this.atmosphere?.enabled)this.airVelocity.sub(this.atmosphere.wind);
  Object.assign(this.diagnostics,{alpha:0,beta:0,criticalAoA:p.critical/t.stall,separated:0,clAttached:0,cl:0,cd:0,liftN:0,stallLiftLossN:0,stallAuthorityMultiplier:1,dragN:0,thrustN:0,weightN:mass*9.81,dynamicPressure:0,authority:0});
  const qs=.5*p.rho*p.cruise*p.cruise*p.area;
  const cl=mass*9.81/(qs*t.lift);
  this.trim=clamp((cl-p.cl0)/p.slope,-.02,.12);
  this.throttle=clamp(qs*(p.cd0+p.induced*cl*cl)*t.drag/(p.engine*t.thrust),0,1);
  if(this.profileId==='bush'){
   // Solve the same force equations used below, including upward thrust.
   let lo=-.04,hi=.20;
   for(let i=0;i<45;i++){
    const a=(lo+hi)/2,c=(p.cl0+p.slope*a)*t.lift;
    const drag=qs*(p.cd0+p.induced*c*c)*t.drag;
    if(qs*c+drag*Math.tan(a)>mass*9.81)hi=a;else lo=a;
   }
   this.trim=(lo+hi)/2;
   const c=(p.cl0+p.slope*this.trim)*t.lift;
   const drag=qs*(p.cd0+p.induced*c*c)*t.drag;
   this.throttle=clamp(drag/(Math.cos(this.trim)*engineAt(p,p.cruise)*t.thrust),0,1);
  }
  this.q.setFromAxisAngle(new Vector3(1,0,0),-this.trim);
  this.previousP=this.p.clone();this.previousQ=this.q.clone();
 }
 step(dt,controls={},recover=true){
  this.previousP.copy(this.p);this.previousQ.copy(this.q);this.time+=dt;
  const t=this.tuning,p=this.profile,mass=this.massKg;
  this.throttle=clamp(this.throttle+(controls.throttle||0)*.23*dt,0,1);
  for(const k of ['pitch','roll','yaw'])this.input[k]+=((controls[k]||0)-this.input[k])*(1-Math.exp(-dt*7));
  const air=this.atmosphere?.enabled?this.airVelocity.copy(this.v).sub(this.atmosphere.update(this.p,this.time,dt)):this.v;
  const speed=Math.max(.1,air.length());
  this.f.set(0,0,1).applyQuaternion(this.q);this.u.set(0,1,0).applyQuaternion(this.q);this.x.set(1,0,0).applyQuaternion(this.q);
  this.inv.copy(this.q).invert();this.local.copy(air).applyQuaternion(this.inv);
  const alpha=Math.atan2(-this.local.y,Math.max(.1,this.local.z));this.alpha=alpha;
  const beta=Math.asin(clamp(this.local.x/speed,-1,1));
  const critical=p.critical/t.stall;
  const separated=smooth(critical,critical+p.stallWidth,Math.abs(alpha));
  this.stall+=(separated-this.stall)*(1-Math.exp(-dt*8));
  const clAttached=clamp(p.cl0+p.slope*alpha,p.clMin,p.clMax);
  const cl=(clAttached*(1-this.stall)+p.postLift*Math.sin(2*alpha)*this.stall)*t.lift;
  const qs=.5*p.rho*speed*speed*p.area;
  this.dir.copy(air).divideScalar(speed);
  // Lift is perpendicular to velocity, so it cannot create kinetic energy.
  this.liftDir.copy(this.u).addScaledVector(this.dir,-this.u.dot(this.dir)).normalize();
  const cd=(p.cd0+p.induced*cl*cl+p.stallDrag*this.stall+p.sideDrag*Math.sin(beta)**2)*t.drag;
  const thrust=p.engine*this.throttle*t.thrust/(1+Math.max(0,speed-p.fadeStart)*p.fadeRate);
  const authority=clamp((speed/p.authoritySpeed)**2,p.authorityMin,p.authorityMax)*(1-p.stallAuthority*this.stall);
  Object.assign(this.diagnostics,{alpha,beta,criticalAoA:critical,separated,clAttached,cl,cd,liftN:qs*cl,stallLiftLossN:Math.max(0,qs*(clAttached*t.lift-cl)),stallAuthorityMultiplier:1-p.stallAuthority*this.stall,dragN:qs*cd,thrustN:thrust,weightN:mass*9.81,dynamicPressure:qs,authority});
  if(this.atmosphere?.enabled)this.airflowResponse.update(this,speed);else this.airflowResponse.clear(this);
  this.force.copy(this.liftDir).multiplyScalar(qs*cl/mass);
  this.force.addScaledVector(this.dir,-qs*cd/mass);
  this.force.addScaledVector(this.f,thrust/mass);
  this.force.addScaledVector(this.x,-qs*p.sideForce*Math.sin(beta)/mass);
  this.force.y-=9.81;
  this.v.addScaledVector(this.force,dt);this.p.addScaledVector(this.v,dt);
  // Weathercock stability + a small coordinated-turn assist; no heading snaps.
  const coordinated=-9.81*this.x.y/Math.max(speed,p.coordinationMin);
  this.w.x+=(this.input.pitch*p.pitchPower*t.pitch*authority +p.pitchStability*(alpha-this.trim)*authority+p.stallMoment*this.stall*Math.sign(alpha)-p.pitchDamping*this.w.x)*dt;
  this.w.y+=(-this.input.yaw*p.yawPower*t.yaw*authority+p.yawStability*beta*authority-p.yawDamping*(this.w.y-coordinated*p.coordination))*dt;
  this.w.z+=(this.input.roll*p.rollPower*t.roll*authority-p.rollDamping*this.w.z)*dt;
  if(this.atmosphere?.enabled){const a=this.airflowResponse.diagnostics;this.w.x+=a.pitchRadPerSec2*dt;this.w.y+=a.yawRadPerSec2*dt;this.w.z+=a.rollRadPerSec2*dt;}
  const angularSpeed=this.w.length();
  if(angularSpeed>1e-8){this.dq.setFromAxisAngle(this.dir.copy(this.w).divideScalar(angularSpeed),angularSpeed*dt);this.q.multiply(this.dq).normalize();}
  if(recover){
   const invalid=!Number.isFinite(this.p.lengthSq()),contact=invalid?null:this.terrainCollision.sweep(this.previousP,this.previousQ,this.p,this.q);
   if(invalid||contact){
    const impact=contact?{positionM:[contact.centerX,contact.centerY,contact.centerZ],velocityMps:this.v.toArray(),contactPositionM:[contact.x,contact.y,contact.z],terrainHeightM:contact.terrainHeightM,surfaceHeightM:contact.heightM,surface:contact.surface,proxy:contact.proxy,sweepFraction:contact.fraction}:null;
    const n=this.resets+1;this.reset();this.resets=n;this.lastImpact=impact;return true;
   }
  }
  return false;
 }
}
