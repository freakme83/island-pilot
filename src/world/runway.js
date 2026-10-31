// One surface definition; a future grass strip can supply different coefficients here.
export const TARMAC=Object.freeze({id:'tarmac',rollingResistance:.018,brakingGrip:.45,lateralGrip:.7});
export const RUNWAY=Object.freeze({x:-1000,z:-1600,elevationM:100,lengthM:1200,widthM:40,headingDeg:0});
// One depth-buffer step gives the asphalt stable priority over the coplanar
// plateau beneath it, while retaining ordinary depth testing and occlusion.
// Keep this smaller than the existing paint bias so markings stay in front.
export const RUNWAY_ASPHALT_DEPTH_BIAS=Object.freeze({polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-1});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function runwayContains(x,z,margin=0){return Math.abs(x-RUNWAY.x)<=RUNWAY.widthM/2+margin&&Math.abs(z-RUNWAY.z)<=RUNWAY.lengthM/2+margin}
export function surfaceAt(x,z){return runwayContains(x,z)?TARMAC:null}
export function levelForRunway(x,z,height){
 // Plateau margins include the enclosing 83 m terrain cells, so the rendered
 // triangles under every part of the narrow pavement are genuinely level.
 const weight=(1-smooth(110,290,Math.abs(x-RUNWAY.x)))*(1-smooth(710,890,Math.abs(z-RUNWAY.z)));
 return height+(RUNWAY.elevationM-height)*weight;
}
