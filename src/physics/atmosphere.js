import {Vector3} from '../vendor/three.js';

// +X east, +Y up, +Z north; wind direction is meteorological FROM.
export const ATMOSPHERE_SEED=17391;
export const atmospherePresets=Object.freeze({
 off:{speedMps:0,fromDeg:270,intensity:0},
 calm:{speedMps:2,fromDeg:270,intensity:.12},
 light:{speedMps:4.5,fromDeg:270,intensity:.65},
 breezy:{speedMps:8,fromDeg:270,intensity:1.15}
});
const origin=Object.freeze({x:0,y:0,z:0});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fade=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
function lattice(x,y,z,seed){
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^seed;
 h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
 return (h>>>0)/2147483647.5-1;
}
// Quintic value noise: continuous values and first/second derivatives at cell edges.
function noise(x,y,z,seed){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=fade(x-ix),v=fade(y-iy),w=fade(z-iz);
 return mix(mix(mix(lattice(ix,iy,iz,seed),lattice(ix+1,iy,iz,seed),u),mix(lattice(ix,iy+1,iz,seed),lattice(ix+1,iy+1,iz,seed),u),v),mix(mix(lattice(ix,iy,iz+1,seed),lattice(ix+1,iy,iz+1,seed),u),mix(lattice(ix,iy+1,iz+1,seed),lattice(ix+1,iy+1,iz+1,seed),u),v),w);
}
export function createConditions(){return {mean:new Vector3(),slowGust:new Vector3(),turbulence:new Vector3(),gust:new Vector3(),wind:new Vector3(),verticalAirflowMps:0}}

export class Atmosphere {
 constructor(preset='light',seed=ATMOSPHERE_SEED){
  if(!atmospherePresets[preset])throw Error('Unknown atmosphere preset');
  this.seed=seed>>>0;this.preset=preset;this.settings={...atmospherePresets[preset]};
  this.center=createConditions();this.mean=this.center.mean;this.wind=this.center.wind;this.gust=this.center.gust;
  this.appliedMean=new Vector3();this.startMean=new Vector3();this.targetMean=new Vector3();this.advection=new Vector3();
  this.appliedIntensity=0;this.startIntensity=0;this.blend=1;
  this.reset();
 }
 get enabled(){return this.preset!=='off'}
 config(){return {modelVersion:'2.1',preset:this.preset,seed:this.seed,meanSpeedMps:this.settings.speedMps,fromDeg:this.settings.fromDeg,gustIntensity:this.settings.intensity}}
 setTarget(){const r=this.settings.fromDeg*Math.PI/180;this.targetMean.set(-Math.sin(r)*this.settings.speedMps,0,-Math.cos(r)*this.settings.speedMps)}
 reset(position=origin){this.setTarget();this.appliedMean.copy(this.targetMean);this.appliedIntensity=this.settings.intensity;this.blend=1;this.advection.set(0,0,0);this.sample(position,0,this.center)}
 set(config){
  const before=this.config();
  if(config.preset!==undefined){if(!atmospherePresets[config.preset])throw Error('Unknown atmosphere preset');this.preset=config.preset;this.settings={...atmospherePresets[config.preset]}}
  if(config.speedMps!==undefined&&Number.isFinite(Number(config.speedMps)))this.settings.speedMps=clamp(Number(config.speedMps),0,12);
  if(config.fromDeg!==undefined&&Number.isFinite(Number(config.fromDeg)))this.settings.fromDeg=((Number(config.fromDeg)%360)+360)%360;
  if(config.intensity!==undefined&&Number.isFinite(Number(config.intensity)))this.settings.intensity=clamp(Number(config.intensity),0,1.5);
  this.startMean.copy(this.appliedMean);this.startIntensity=this.appliedIntensity;this.setTarget();this.blend=0;
  if(!this.enabled){this.appliedMean.set(0,0,0);this.appliedIntensity=0;this.blend=1;this.sample(origin,0,this.center)}
  return before;
 }
 // Advance setting interpolation ONCE per physics step; spatial queries do not advance time.
 update(position,time,dt){
  if(this.enabled&&this.blend<1){this.blend=Math.min(1,this.blend+dt/3);const f=fade(this.blend);this.appliedMean.lerpVectors(this.startMean,this.targetMean,f);this.appliedIntensity=mix(this.startIntensity,this.settings.intensity,f)}
  if(this.enabled)this.advection.addScaledVector(this.appliedMean,dt);
  this.sample(position,time,this.center);return this.wind;
 }
 // Pure field query into caller-owned storage, usable by future weather visuals.
 sample(position,time,out){
  out.mean.copy(this.appliedMean);if(!this.enabled)out.mean.set(0,0,0);out.slowGust.set(0,0,0);out.turbulence.set(0,0,0);out.verticalAirflowMps=0;
  if(this.enabled&&this.appliedIntensity>0){
   const k=this.appliedIntensity,seed=this.seed;
   // Advection + slow evolution gives irregular encounters as aircraft travel through air.
   const x=position.x-this.advection.x,z=position.z-this.advection.z,y=position.y;
   const sx=x/210+time*.025,sy=y/280+time*.013,sz=z/210-time*.019;
   out.slowGust.set(3.1*k*noise(sx,sy,sz,seed+11),0,3.1*k*noise(sx+17,sy-9,sz+31,seed+23));
   out.verticalAirflowMps=1.8*k*noise(x/145+time*.021,y/190,z/145+time*.017,seed+37);
   const tx=x/24+time*.08,ty=y/29-time*.045,tz=z/24+time*.059;
   // Two non-aligned scales; the small scale matters to wing/tail differences.
   out.turbulence.set(
    k*(1.3*noise(tx,ty,tz,seed+41)+.55*noise(tx*2.17+5,ty*1.83,tz*2.09,seed+43)),
    k*(2.4*noise(tx+13,ty+7,tz-21,seed+53)+1.05*noise(tx*2.17,ty*1.83+11,tz*2.09,seed+59)),
    k*(1.3*noise(tx-18,ty+19,tz+8,seed+61)+.55*noise(tx*2.17-7,ty*1.83,tz*2.09+14,seed+67)));
  }
  out.gust.copy(out.slowGust).add(out.turbulence);out.gust.y+=out.verticalAirflowMps;
  out.wind.copy(out.mean).add(out.gust);return out;
 }
}
