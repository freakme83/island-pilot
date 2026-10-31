const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export const terrainAirflowTuning=Object.freeze({heightScaleM:450,upstreamDistanceM:350,liftFactor:.9,sinkFactor:.55,maxUpMps:4,maxSinkMps:3,maxLeeTurbulenceBoost:.65});
export class TerrainAirflow {
 constructor(terrain){this.terrain=terrain;this.gradient={x:0,z:0}}
 apply(position,windX,windZ,out){
  const t=terrainAirflowTuning,info=out.terrain,h=this.terrain.height(position.x,position.z),clearance=position.y-h;
  info.heightM=h;info.clearanceM=clearance;info.verticalMps=0;info.turbulenceMultiplier=1;info.regime='NEUTRAL';
  const speed=Math.hypot(windX,windZ);if(speed<1e-6)return;
  const g=this.terrain.gradient(position.x,position.z,this.gradient),alignment=windX*g.x+windZ*g.z;
  const upstream=this.terrain.height(position.x-windX/speed*t.upstreamDistanceM,position.z-windZ/speed*t.upstreamDistanceM);
  const downhill=Math.max(0,-alignment/speed,(upstream-h)/t.upstreamDistanceM),attenuation=Math.exp(-Math.max(0,clearance)/t.heightScaleM);
  const net=(Math.max(0,alignment)*t.liftFactor-speed*downhill*t.sinkFactor)*attenuation;
  const limit=net>=0?t.maxUpMps:t.maxSinkMps;
  info.verticalMps=limit*Math.tanh(net/limit);
  const lee=smooth(.02,.30,downhill)*(speed*speed/(speed*speed+16))*attenuation;
  info.turbulenceMultiplier=1+t.maxLeeTurbulenceBoost*lee;
  // Amplify the existing local field; differential-airflow response remains the only moment source.
  out.turbulence.multiplyScalar(info.turbulenceMultiplier);
  if(info.verticalMps>.1)info.regime='WINDWARD LIFT';else if(info.verticalMps<-.1)info.regime='LEEWARD SINK';
 }
}
