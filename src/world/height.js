const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function ground(x,z){
 const river=560*Math.sin(z*.00026)+180*Math.sin(z*.00073);
 const d=Math.abs(x-river);
 const hills=95+62*Math.sin(x*.00038+.6)*Math.cos(z*.00031)+38*Math.sin(z*.00081+x*.00028)+24*Math.cos(x*.0017-z*.0009);
 const ridge=210*Math.pow(.5+.5*Math.sin(x*.00034+z*.00017-1.2),4);
 return 9+(hills+ridge)*smooth(85,430,d);
}
