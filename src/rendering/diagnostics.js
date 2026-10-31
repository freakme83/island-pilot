export const DEFAULT_CAMERA_NEAR_M=.25;
const DEFAULT_CAMERA_FAR_M=40000;
function numericInRange(value,min,max,name){
 if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${name} must be a finite number`);
 if(value<min||value>max)throw new RangeError(`${name} must be between ${min} and ${max}`);
 return value;
}
export function createRenderDiagnostics({renderer,camera,world}){
 let runwayVisualOffsetM=0,cameraNearM=DEFAULT_CAMERA_NEAR_M,terrainVisible=true,waterVisible=true,runwayPaintVisible=true;
 const setRunwayVisualOffset=value=>{runwayVisualOffsetM=numericInRange(value,0,.5,'runway visual offset');world.setRunwayVisualOffset(runwayVisualOffsetM)};
 const setCameraNear=value=>{cameraNearM=numericInRange(value,.1,1,'camera near');camera.near=cameraNearM;camera.updateProjectionMatrix()};
 const setTerrainVisible=value=>{if(typeof value!=='boolean')throw new TypeError('terrain visibility must be boolean');terrainVisible=value;world.setTerrainVisible(value)};
 const setWaterVisible=value=>{if(typeof value!=='boolean')throw new TypeError('water visibility must be boolean');waterVisible=value;world.setWaterVisible(value)};
 const setRunwayPaintVisible=value=>{if(typeof value!=='boolean')throw new TypeError('runway paint visibility must be boolean');runwayPaintVisible=value;world.setRunwayPaintVisible(value)};
 function reset(){setRunwayVisualOffset(0);setCameraNear(DEFAULT_CAMERA_NEAR_M);setTerrainVisible(true);setWaterVisible(true);setRunwayPaintVisible(true)}
 function getState(){
  let depthBits=null,antialias=null,samples=null;
  try{const gl=renderer.getContext(),attributes=gl?.getContextAttributes?.();if(gl&&!gl.isContextLost?.()){depthBits=gl.getParameter(gl.DEPTH_BITS);antialias=attributes?.antialias??null;samples=gl.getParameter(gl.SAMPLES)}}catch{}
  return {runwayVisualOffsetM,cameraNearM,cameraFarM:camera.far,terrainVisible,waterVisible,runwayPaintVisible,depthBits,antialias,samples,drawCalls:renderer.info?.render?.calls??null,triangles:renderer.info?.render?.triangles??null};
 }
 function describe(){return 'renderDiagnostics: getState(), reset(), setRunwayVisualOffset(0..0.5 m), setCameraNear(0.1..1 m), setTerrainVisible(boolean), setWaterVisible(boolean), setRunwayPaintVisible(boolean). Suggested tests: raise runway at 0/0.05/0.2/0.5 m; near at 0.25/0.5/1 m; hide terrain, water and paint independently; reset between tests.'}
 return {getState,reset,setRunwayVisualOffset,setCameraNear,setTerrainVisible,setWaterVisible,setRunwayPaintVisible,describe};
}
