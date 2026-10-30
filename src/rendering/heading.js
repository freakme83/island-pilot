// Simulation forward is local +Z; +Z is world north and +X is east.
export const headingFromXZ=(x,z,fallback=0)=>x*x+z*z<1e-8?fallback:(Math.atan2(x,z)*180/Math.PI+360)%360;
export const shortestHeadingDelta=(from,to)=>((to-from+540)%360)-180;
export function aircraftHeading(q,fallback=0){
 // Rotation of local +Z by quaternion; ignores imported GLB model orientation.
 const x=2*(q.x*q.z+q.w*q.y),z=1-2*(q.x*q.x+q.y*q.y);
 return headingFromXZ(x,z,fallback);
}
