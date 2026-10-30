import * as THREE from '../vendor/three.js';
import {defaults} from '../config/profiles.js';
import {ground} from '../world/height.js';
export function createInterface({sim,recorder,stallDiagnostic,recordEvent,startRecording,stopRecording,exportRecording,discardRecording,pendingTuning,flushTuning,configSnapshot,reset,cameraRig,renderer,$}){
const {cameraSettings,updateCameraControls}=cameraRig;
$('record-start').addEventListener('click',startRecording);$('record-stop').addEventListener('click',stopRecording);$('record-export').addEventListener('click',exportRecording);$('record-discard').addEventListener('click',discardRecording);$('show-fps').addEventListener('change',()=>{recorder.showFps=$('show-fps').checked;$('live-fps').hidden=!recorder.showFps});
const ranges=[['thrust','Engine thrust',.65,1.5],['lift','Lift strength',.7,1.35],['drag','Drag',.65,1.6],['pitch','Pitch response',.6,1.5],['roll','Roll response',.6,1.5],['yaw','Yaw response',.6,1.5],['stall','Stall sensitivity',.7,1.4]];
for(const [id,label,min,max] of ranges){const row=document.createElement('label');row.className='slider';row.htmlFor=id;row.innerHTML=`<span>${label}</span><output id="${id}-value">1.00×</output><input id="${id}" type="range" min="${min}" max="${max}" step=".05" value="1">`;$('sliders').appendChild(row);$(id).addEventListener('input',()=>{const old=sim.tuning[id];sim.tuning[id]=Number($(id).value);$(id+'-value').textContent=Number($(id).value).toFixed(2)+'×';if(old!==sim.tuning[id]){const pending=pendingTuning.get(id);pendingTuning.set(id,{oldValue:pending?.oldValue??old,newValue:sim.tuning[id]});clearTimeout(window['tuneTimer_'+id]);window['tuneTimer_'+id]=setTimeout(flushTuning,180);}});}
function syncTuning(){for(const [id]of ranges){$(id).value=sim.tuning[id];$(id+'-value').textContent=sim.tuning[id].toFixed(2)+'×';}}
$('profile').addEventListener('change',()=>{const old=sim.profileId;sim.selectProfile($('profile').value);syncTuning();reset();recordEvent('profile_changed',{oldProfile:old,newProfile:sim.profileId,configuration:configSnapshot()});recordEvent('flight_reset',{cause:'profile_changed'});});
$('defaults').addEventListener('click',()=>{for(const [id]of ranges){const old=sim.tuning[id];if(old!==1)recordEvent('tuning_changed',{parameter:id,oldValue:old,newValue:1,configuration:{profile:sim.profile.label,physics:{...sim.profile,tuning:{...defaults}}}})}sim.restoreDefaults();syncTuning();reset();});
$('camera-distance').addEventListener('input',()=>{cameraSettings.distance=Number($('camera-distance').value);updateCameraControls();});
$('camera-elevation').addEventListener('input',()=>{cameraSettings.elevation=Number($('camera-elevation').value);updateCameraControls();});
renderer.domElement.addEventListener('wheel',event=>{event.preventDefault();const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);cameraSettings.distance=Math.round(10*THREE.MathUtils.clamp(cameraSettings.distance*Math.exp(THREE.MathUtils.clamp(pixels,-300,300)*.0012),10,65))/10;updateCameraControls();},{passive:false});
updateCameraControls();
// Native commands + compact local fallback; no external polyfill or network.
if(!('commandForElement' in HTMLButtonElement.prototype)){
 document.querySelectorAll('button[commandfor]').forEach(b=>b.addEventListener('click',()=>{const p=$(b.getAttribute('commandfor'));if('popover' in HTMLElement.prototype){p.togglePopover();}else{document.querySelectorAll('.panel').forEach(other=>{if(other!==p)other.hidden=true;});p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));}}));
}
if(!('popover' in HTMLElement.prototype)){
 document.querySelectorAll('.panel').forEach(p=>{p.hidden=true;});document.addEventListener('keydown',e=>{if(e.code==='Escape')document.querySelectorAll('.panel').forEach(p=>{p.hidden=true;});});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.panel,button[commandfor]'))document.querySelectorAll('.panel').forEach(p=>{p.hidden=true;});});
}
let hudTime=0,lastStallStatusMessage='';
function updateHud(dt){hudTime+=dt; if(hudTime>.08){hudTime=0;$('speed').textContent=Math.round(sim.v.length()*3.6);$('altitude').textContent=Math.round(Math.max(0,sim.p.y-ground(sim.p.x,sim.p.z))*3.28084/10)*10;const vs=sim.v.y,vsFpm=Math.round(vs*196.8504/50)*50;$('vertical').textContent=(vs>=0?'+':'−')+Math.abs(vsFpm);$('throttle').textContent=Math.round(sim.throttle*100);const phase=stallDiagnostic.phase,warning=$('stall-warning'),diag=sim.diagnostics,alphaDeg=(diag.alpha??sim.alpha)*180/Math.PI,criticalDeg=(diag.criticalAoA??sim.profile.critical/sim.tuning.stall)*180/Math.PI;warning.textContent=phase;warning.dataset.phase=phase;warning.classList.toggle('visible',phase!=='NORMAL');const lowSpeedWarning=sim.v.length()<sim.profile.warningSpeed&&sim.alpha>.11;$('low-speed-warning').classList.toggle('visible',lowSpeedWarning);const statusMessage=[phase!=='NORMAL'?phase:'',lowSpeedWarning?'LOW AIRSPEED':''].filter(Boolean).join('. ');if(statusMessage!==lastStallStatusMessage){$('flight-status-announcer').textContent=statusMessage;lastStallStatusMessage=statusMessage}$('stall-diag-aoa').textContent=alphaDeg.toFixed(2)+'°';$('stall-diag-critical').textContent=criticalDeg.toFixed(2)+'°';$('stall-diag-effect').textContent=sim.stall.toPrecision(4);$('stall-diag-phase').textContent=phase;}
}

return {updateHud};
}
