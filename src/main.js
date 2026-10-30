import {Flight} from './physics/Flight.js';
import {Atmosphere,ATMOSPHERE_SEED} from './physics/atmosphere.js';
import {ground,terrain} from './world/height.js';
import {createScene} from './rendering/scene.js';
import {createWorld} from './world/world.js';
import {createAircraft} from './aircraft/aircraft.js';
import {createCamera} from './rendering/camera.js';
import {createRecorder} from './telemetry/recorder.js';
import {createKeyboard} from './controls/keyboard.js';
import {createInterface} from './ui/interface.js';

const $=id=>document.getElementById(id);
const atmosphere=new Atmosphere('light',ATMOSPHERE_SEED,terrain);
const sim=new Flight('bush',atmosphere);
const keys=new Set();
let accumulator=0,previous=performance.now(),paused=false;
const {scene,renderer,camera,sky,ocean}=createScene($);
const flightRecorder=createRecorder({sim,keys,renderer,ground,$,isPaused:()=>paused});
const world=createWorld({sim,scene,ocean,$});
let cameraRig;
const aircraft=createAircraft({sim,scene,$,onLoaded:()=>cameraRig.syncCamera(true)});
cameraRig=createCamera({camera,plane:aircraft.plane,sky,surfaceHeight:world.surfaceHeight,$});
function reset(){
 flightRecorder.clearHeldControls('flight_reset');sim.reset();flightRecorder.resetStallDiagnosticState();
 accumulator=0;aircraft.plane.position.copy(sim.p);aircraft.plane.quaternion.copy(sim.q);
 world.updateTerrain();world.updateTrees();cameraRig.syncCamera(true);
 flightRecorder.recordEvent('flight_reset',{cause:'manual'});
}
const keyboard=createKeyboard({keys,recordEvent:flightRecorder.recordEvent,clearHeldControls:flightRecorder.clearHeldControls,reset,cameraRig,setPaused:v=>{paused=v},setPrevious:v=>{previous=v},setAccumulator:v=>{accumulator=v}});
const ui=createInterface({sim,atmosphere,...flightRecorder,reset,cameraRig,renderer,$});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('error').hidden=false;$('error').textContent='Graphics paused. Reload this file to resume.';});
function animate(now){
 requestAnimationFrame(animate);
 const rawDt=(now-previous)/1000,dt=Math.min(rawDt,.1);previous=now;
 if(!aircraft.loaded||paused)return;
 flightRecorder.recordPerformance(now,rawDt);flightRecorder.updateDiagnostics(now,rawDt);
 accumulator+=dt;const input=keyboard.controls();let recovered=false;
 while(accumulator>=1/120){
  const wasStalled=sim.stall>.35;
  const didReset=sim.step(1/120,input);recovered=didReset||recovered;accumulator-=1/120;
  flightRecorder.recordTick(didReset,1/120);
  if(wasStalled!==(sim.stall>.35))flightRecorder.recorder.wasStalled=sim.stall>.35;
 }
 const blend=accumulator*120;
 aircraft.plane.position.lerpVectors(sim.previousP,sim.p,blend);
 aircraft.plane.quaternion.slerpQuaternions(sim.previousQ,sim.q,blend);
 aircraft.updateVisual(dt);
 world.updateTerrain();world.updateTrees();cameraRig.syncCamera(recovered,dt);
 ui.updateHud(dt);
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
window.flightLab={recorder:flightRecorder.recorder,getState:()=>({ready:aircraft.loaded,speed:flightRecorder.stateSnapshot().airspeedMps,altitude:sim.p.y-ground(sim.p.x,sim.p.z),vertical:sim.v.y,throttle:sim.throttle,stall:sim.stall,stallDiagnostics:flightRecorder.stateSnapshot().stallDiagnostics,position:sim.p.toArray(),quaternion:sim.q.toArray(),profile:sim.profileId,atmosphere:atmosphere.config(),wind:atmosphere.wind.toArray(),camera:{...cameraRig.cameraSettings,actualDistance:camera.position.distanceTo(aircraft.plane.position),preset:cameraRig.presetIndex},trees:{...world.treeStats},tuning:{...sim.tuning},meshes:renderer.info.render.calls,triangles:renderer.info.render.triangles}),reset};
