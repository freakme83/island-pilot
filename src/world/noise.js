// Seeded quintic value noise, shared by terrain and atmosphere.
const fade=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
function lattice(x,y,z,seed){
 let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^seed;
 h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
 return (h>>>0)/2147483647.5-1;
}
export function noise(x,y,z,seed){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=fade(x-ix),v=fade(y-iy),w=fade(z-iz);
 return mix(mix(mix(lattice(ix,iy,iz,seed),lattice(ix+1,iy,iz,seed),u),mix(lattice(ix,iy+1,iz,seed),lattice(ix+1,iy+1,iz,seed),u),v),mix(mix(lattice(ix,iy,iz+1,seed),lattice(ix+1,iy,iz+1,seed),u),mix(lattice(ix,iy+1,iz+1,seed),lattice(ix+1,iy+1,iz+1,seed),u),v),w);
}
