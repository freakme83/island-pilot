export function makeTerrain(meta, data) {
  const {width:w,height:h,widthMeters:W,depthMeters:D}=meta;
  if(data.length!==w*h) throw Error('Unexpected height data size');
  function heightAt(x,z) {
    const u=(x/W+.5)*(w-1),v=(z/D+.5)*(h-1);
    if(u<0||v<0||u>w-1||v>h-1) return null;
    const i=Math.min(Math.floor(u),w-2),j=Math.min(Math.floor(v),h-2), a=u-i,b=v-j;
    return (data[j*w+i]*(1-a)+data[j*w+i+1]*a)*(1-b)+(data[(j+1)*w+i]*(1-a)+data[(j+1)*w+i+1]*a)*b;
  }
  return {meta,data,heightAt};
}
