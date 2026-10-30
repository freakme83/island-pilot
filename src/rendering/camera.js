import * as THREE from '../vendor/three.js';
export function createCamera({camera,plane,sky,surfaceHeight,$}){
const presets=[{distance:17,elevation:18},{distance:38,elevation:24}];
const cameraSettings={...presets[0]};let cameraDistance=cameraSettings.distance,cameraElevation=cameraSettings.elevation;
const forward=new THREE.Vector3(0,0,1),chaseDirection=new THREE.Vector3(0,0,1),cameraUp=new THREE.Vector3(0,1,0),worldUp=new THREE.Vector3(0,1,0),oldDirection=new THREE.Vector3(),projectedUp=new THREE.Vector3(),cross=new THREE.Vector3(),desired=new THREE.Vector3(),target=new THREE.Vector3(),transport=new THREE.Quaternion();
function updateCameraControls(){
 $('camera-distance').value=cameraSettings.distance;$('camera-distance-value').textContent=cameraSettings.distance.toFixed(1)+' m';
 $('camera-elevation').value=cameraSettings.elevation;$('camera-elevation-value').textContent=Math.round(cameraSettings.elevation)+'°';
}
function setPreset(index){presetIndex=index;Object.assign(cameraSettings,presets[index]);updateCameraControls();}
function syncCamera(snap=false,dt=1/60){
 forward.set(0,0,1).applyQuaternion(plane.quaternion);
 if(snap){chaseDirection.copy(forward);cameraUp.copy(worldUp);cameraDistance=cameraSettings.distance;cameraElevation=cameraSettings.elevation;}
 else{
  oldDirection.copy(chaseDirection);chaseDirection.lerp(forward,1-Math.exp(-dt*8)).normalize();
  transport.setFromUnitVectors(oldDirection,chaseDirection);cameraUp.applyQuaternion(transport);
  cameraDistance+=(cameraSettings.distance-cameraDistance)*(1-Math.exp(-dt*7));
  cameraElevation+=(cameraSettings.elevation-cameraElevation)*(1-Math.exp(-dt*7));
 }
 // Parallel transport through vertical flight. Gently restore a world-up horizon
 // away from the poles instead of switching lookAt's up vector abruptly.
 cameraUp.addScaledVector(chaseDirection,-cameraUp.dot(chaseDirection)).normalize();
 projectedUp.copy(worldUp).addScaledVector(chaseDirection,-worldUp.dot(chaseDirection));
 const poleDistance=projectedUp.length();
 if(poleDistance>.001){projectedUp.normalize();const twist=Math.atan2(cross.crossVectors(cameraUp,projectedUp).dot(chaseDirection),cameraUp.dot(projectedUp));cameraUp.applyAxisAngle(chaseDirection,THREE.MathUtils.clamp(twist,-dt*.9*poleDistance*poleDistance,dt*.9*poleDistance*poleDistance));}
 const angle=THREE.MathUtils.degToRad(cameraElevation);
 // Anchor translation to the interpolated aircraft: speed cannot stretch the
 // selected chase distance through positional smoothing lag.
 desired.copy(plane.position).addScaledVector(chaseDirection,-cameraDistance*Math.cos(angle)).addScaledVector(cameraUp,cameraDistance*Math.sin(angle));
 desired.y=Math.max(desired.y,surfaceHeight(desired.x,desired.z)+2.5);
 camera.position.copy(desired);target.copy(plane.position).addScaledVector(cameraUp,.3);
 camera.up.copy(cameraUp);camera.lookAt(target);sky.position.copy(camera.position);
}

return {cameraSettings,updateCameraControls,setPreset,syncCamera,get presetIndex(){return presetIndex}};
}
