import {Vector3,Quaternion} from '../vendor/three.js';
import {ground,WATER_LEVEL_M} from '../world/height.js';
// From the actual leveled aircraft bounds: x +/-4.5, y -1.82..1.75, z -4.63..3.60 m.
// Vertical-radius margins conservatively cover fuselage and wing thickness.
const points=[
 [0,0,0,1.9,'body'],[0,-1.8,0,.4,'belly'],[0,0,3.6,.6,'nose'],[0,.3,-4.6,.5,'tail'],[0,1.75,-3.7,.35,'fin'],
 [-4.5,0,0,.45,'left wing'],[4.5,0,0,.45,'right wing'],
 [-4.2,0,1,.35,'left leading edge'],[4.2,0,1,.35,'right leading edge'],
 [-4.2,0,-1,.35,'left trailing edge'],[4.2,0,-1,.35,'right trailing edge']
];
// The coarse V2.2 body/belly spheres included landing gear. Bush ground support
// needs airframe-only points, while actual wheel contact is checked by GroundHandling.
const gearAwarePoints=[
 [0,-.55,0,.35,'body'],[0,-.88,-1,.08,'belly'],[0,-.3,2.8,.25,'nose'],[0,-1.18,3.1,.06,'propeller'],[0,-.5,-4.1,.04,'tail'],
 ...points.slice(4)
];
export class TerrainCollision {
 constructor(){this.position=new Vector3();this.rotation=new Quaternion();this.point=new Vector3();this.contact={}}
 clearance(position,rotation,gearAware=false){
  const proxies=gearAware?gearAwarePoints:points;
  let min=Infinity;for(const p of proxies){this.point.set(p[0],p[1],p[2]).applyQuaternion(rotation).add(position);min=Math.min(min,this.point.y-Math.max(WATER_LEVEL_M,ground(this.point.x,this.point.z))-p[3])}return min;
 }
 sweep(startP,startQ,endP,endQ,gearAware=false){
  const proxies=gearAware?gearAwarePoints:points;
  // Limit proxy travel to 2 m, including rotation. Normal flight needs 1 substep.
  const steps=Math.max(1,Math.ceil((startP.distanceTo(endP)+startQ.angleTo(endQ)*6)/2));
  for(let i=0;i<=steps;i++){
   const fraction=i/steps;this.position.lerpVectors(startP,endP,fraction);this.rotation.slerpQuaternions(startQ,endQ,fraction);
   for(const p of proxies){
    this.point.set(p[0],p[1],p[2]).applyQuaternion(this.rotation).add(this.position);const terrainHeight=ground(this.point.x,this.point.z),height=Math.max(WATER_LEVEL_M,terrainHeight);
    if(this.point.y-height<=p[3]){const c=this.contact;c.fraction=fraction;c.proxy=p[4];c.x=this.point.x;c.y=height;c.z=this.point.z;c.centerX=this.position.x;c.centerY=this.position.y;c.centerZ=this.position.z;c.heightM=height;c.terrainHeightM=terrainHeight;c.surface=terrainHeight<WATER_LEVEL_M?'water':'terrain';return c}
   }
  }
  return null;
 }
}
