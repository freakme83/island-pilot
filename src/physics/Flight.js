import {Vector3,Quaternion} from '../vendor/three.js';
import {defaults,profiles} from '../config/profiles.js';
import {ground} from '../world/height.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function engineAt(p,speed){return p.engine/(1+Math.max(0,speed-p.fadeStart)*p.fadeRate);}

export class Flight {
 constructor(profileId="bush"){this.profileId=profileId;this.profile=profiles[profileId];this.tunings={bush:{...defaults},fighter:{...defaults}};this.tuning=this.tunings[profileId];this.p=new Vector3();this.v=new Vector3();this.q=new Quaternion();this.w=new Vector3();this.input={pitch:0,roll:0,yaw:0};this.diagnostics={};this.f=new Vector3();this.u=new Vector3();this.x=new Vector3();this.local=new Vector3();this.dir=new Vector3();this.liftDir=new Vector3();this.force=new Vector3();this.dq=new Quaternion();this.inv=new Quaternion();this.reset();}
 selectProfile(id){if(!profiles[id])return;this.profileId=id;this.profile=profiles[id];this.tuning=this.tunings[id];this.reset();}
 restoreDefaults(){Object.assign(this.tuning,defaults);this.reset();}
 reset(){
  const p=this.profile,t=this.tuning;
  this.p.set(-1200,ground(-1200,0)+p.startHeight,0);this.v.set(0,0,p.cruise);this.w.set(0,0,0);this.input={pitch:0,roll:0,yaw:0};this.stall=0;this.alpha=0;this.time=0;this.resets=0;
  Object.assign(this.diagnostics,{alpha:0,beta:0,criticalAoA:p.critical/t.stall,separated:0,clAttached:0,cl:0,cd:0,liftN:0,stallLiftLossN:0,stallAuthorityMultiplier:1,dragN:0,thrustN:0,weightN:p.mass*9.81,dynamicPressure:0,authority:0});
  const qs=.5*p.rho*p.cruise*p.cruise*p.area;
  const cl=p.mass*9.81/(qs*t.lift);
  this.trim=clamp((cl-p.cl0)/p.slope,-.02,.12);
  this.throttle=clamp(qs*(p.cd0+p.induced*cl*cl)*t.drag/(p.engine*t.thrust),0,1);
  if(this.profileId==='bush'){
   // Solve the same force equations used below, including upward thrust.
   let lo=-.04,hi=.20;
   for(let i=0;i<45;i++){
    const a=(lo+hi)/2,c=(p.cl0+p.slope*a)*t.lift;
    const drag=qs*(p.cd0+p.induced*c*c)*t.drag;
    if(qs*c+drag*Math.tan(a)>p.mass*9.81)hi=a;else lo=a;
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
  const t=this.tuning,p=this.profile;
  this.throttle=clamp(this.throttle+(controls.throttle||0)*.23*dt,0,1);
  for(const k of ['pitch','roll','yaw'])this.input[k]+=((controls[k]||0)-this.input[k])*(1-Math.exp(-dt*7));
  const speed=Math.max(.1,this.v.length());
  this.f.set(0,0,1).applyQuaternion(this.q);this.u.set(0,1,0).applyQuaternion(this.q);this.x.set(1,0,0).applyQuaternion(this.q);
  this.inv.copy(this.q).invert();this.local.copy(this.v).applyQuaternion(this.inv);
  const alpha=Math.atan2(-this.local.y,Math.max(.1,this.local.z));this.alpha=alpha;
  const beta=Math.asin(clamp(this.local.x/speed,-1,1));
  const critical=p.critical/t.stall;
  const separated=smooth(critical,critical+p.stallWidth,Math.abs(alpha));
  this.stall+=(separated-this.stall)*(1-Math.exp(-dt*8));
  const clAttached=clamp(p.cl0+p.slope*alpha,p.clMin,p.clMax);
  const cl=(clAttached*(1-this.stall)+p.postLift*Math.sin(2*alpha)*this.stall)*t.lift;
  const qs=.5*p.rho*speed*speed*p.area;
  this.dir.copy(this.v).divideScalar(speed);
  // Lift is perpendicular to velocity, so it cannot create kinetic energy.
  this.liftDir.copy(this.u).addScaledVector(this.dir,-this.u.dot(this.dir)).normalize();
  const cd=(p.cd0+p.induced*cl*cl+p.stallDrag*this.stall+p.sideDrag*Math.sin(beta)**2)*t.drag;
  const thrust=p.engine*this.throttle*t.thrust/(1+Math.max(0,speed-p.fadeStart)*p.fadeRate);
  const authority=clamp((speed/p.authoritySpeed)**2,p.authorityMin,p.authorityMax)*(1-p.stallAuthority*this.stall);
  Object.assign(this.diagnostics,{alpha,beta,criticalAoA:critical,separated,clAttached,cl,cd,liftN:qs*cl,stallLiftLossN:Math.max(0,qs*(clAttached*t.lift-cl)),stallAuthorityMultiplier:1-p.stallAuthority*this.stall,dragN:qs*cd,thrustN:thrust,weightN:p.mass*9.81,dynamicPressure:qs,authority});
  this.force.copy(this.liftDir).multiplyScalar(qs*cl/p.mass);
  this.force.addScaledVector(this.dir,-qs*cd/p.mass);
  this.force.addScaledVector(this.f,thrust/p.mass);
  this.force.addScaledVector(this.x,-qs*p.sideForce*Math.sin(beta)/p.mass);
  this.force.y-=9.81;
  this.v.addScaledVector(this.force,dt);this.p.addScaledVector(this.v,dt);
  // Weathercock stability + a small coordinated-turn assist; no heading snaps.
  const coordinated=-9.81*this.x.y/Math.max(speed,p.coordinationMin);
  this.w.x+=(this.input.pitch*p.pitchPower*t.pitch*authority +p.pitchStability*(alpha-this.trim)*authority+p.stallMoment*this.stall*Math.sign(alpha)-p.pitchDamping*this.w.x)*dt;
  this.w.y+=(-this.input.yaw*p.yawPower*t.yaw*authority+p.yawStability*beta*authority-p.yawDamping*(this.w.y-coordinated*p.coordination))*dt;
  this.w.z+=(this.input.roll*p.rollPower*t.roll*authority-p.rollDamping*this.w.z)*dt;
  const angularSpeed=this.w.length();
  if(angularSpeed>1e-8){this.dq.setFromAxisAngle(this.dir.copy(this.w).divideScalar(angularSpeed),angularSpeed*dt);this.q.multiply(this.dq).normalize();}
  if(recover && (this.p.y<ground(this.p.x,this.p.z)+9 || !Number.isFinite(this.p.lengthSq()))){const n=this.resets+1;this.reset();this.resets=n;return true;}
  return false;
 }
}
