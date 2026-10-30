import {Vector3} from '../vendor/three.js';

// Coordinates: +Z is north, +X east, +Y up. Direction is meteorological FROM.
export const ATMOSPHERE_SEED = 17391;
export const atmospherePresets = Object.freeze({
 off:{speedMps:0,fromDeg:270,intensity:0},
 calm:{speedMps:2,fromDeg:270,intensity:.2},
 light:{speedMps:4.5,fromDeg:270,intensity:.55},
 breezy:{speedMps:8,fromDeg:270,intensity:1}
});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const phase=(seed,n)=>{let x=(seed+n*1013904223)>>>0;x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;return (x>>>0)/4294967296*Math.PI*2};

export class Atmosphere {
 constructor(preset='light',seed=ATMOSPHERE_SEED){
  this.seed=seed>>>0;this.preset=preset;this.settings={...atmospherePresets[preset]};
  this.mean=new Vector3();this.wind=new Vector3();this.gust=new Vector3();
  this.angular={pitch:0,yaw:0,roll:0};this.blend=1;this.startMean=new Vector3();this.startGust=new Vector3();
  this.sample(0,0);
 }
 get enabled(){return this.preset!=='off'}
 config(){return {preset:this.preset,seed:this.seed,meanSpeedMps:this.settings.speedMps,fromDeg:this.settings.fromDeg,gustIntensity:this.settings.intensity}}
 reset(){this.blend=1;this.sample(0,0)}
 set(config){
  const before=this.config();
  if(config.preset!==undefined){if(!atmospherePresets[config.preset])throw Error('Unknown atmosphere preset');this.preset=config.preset;this.settings={...atmospherePresets[config.preset]}}
  if(config.speedMps!==undefined)this.settings.speedMps=clamp(Number(config.speedMps),0,12);
  if(config.fromDeg!==undefined)this.settings.fromDeg=((Number(config.fromDeg)%360)+360)%360;
  if(config.intensity!==undefined)this.settings.intensity=clamp(Number(config.intensity),0,1.5);
  // Ease the airflow from its last applied value; never alter aircraft velocity or pose.
  this.startMean.copy(this.mean);this.startGust.copy(this.gust);this.blend=this.enabled?0:1;
  if(!this.enabled)this.sample(0,0);
  return before;
 }
 sample(t,dt){
  if(!this.enabled){this.mean.set(0,0,0);this.wind.set(0,0,0);this.gust.set(0,0,0);this.angular.pitch=0;this.angular.yaw=0;this.angular.roll=0;return this.wind}
  const direction=this.settings.fromDeg*Math.PI/180,speed=this.settings.speedMps,intensity=this.settings.intensity;
  this.mean.set(-Math.sin(direction)*speed,0,-Math.cos(direction)*speed);
  // Continuous, seeded, low-frequency components. No random impulse or camera motion.
  const wave=(n,f)=>Math.sin(t*f+phase(this.seed,n));
  this.gust.set(intensity*(1.05*wave(1,.57)+.36*wave(2,1.17)),intensity*(.42*wave(3,.71)+.16*wave(4,1.43)),intensity*(.85*wave(5,.43)+.32*wave(6,1.09)));
  this.angular.pitch=intensity*.013*(wave(7,.82)+.4*wave(8,1.51));
  this.angular.yaw=intensity*.009*(wave(9,.61)+.4*wave(10,1.27));
  this.angular.roll=intensity*.025*(wave(11,.67)+.35*wave(12,1.38));
  if(this.blend<1){this.blend=Math.min(1,this.blend+dt/3);const f=this.blend*this.blend*(3-2*this.blend);this.mean.lerpVectors(this.startMean,this.mean,f);this.gust.lerpVectors(this.startGust,this.gust,f);this.angular.pitch*=f;this.angular.yaw*=f;this.angular.roll*=f}
  this.wind.copy(this.mean).add(this.gust);
  return this.wind;
 }
}
