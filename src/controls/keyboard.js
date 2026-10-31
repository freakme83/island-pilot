export const controlKeys={KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',KeyQ:'Q',KeyE:'E',KeyB:'Brake',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl'};
export function createKeyboard({keys,recordEvent,clearHeldControls,reset,cameraRig,setPaused,setPrevious,setAccumulator}){
const gameplay=new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyC','KeyR','KeyB']);
window.addEventListener('keydown',e=>{
 if(!gameplay.has(e.code))return;e.preventDefault();
 if(e.code==='KeyR'){if(!e.repeat)reset();return;}
 if(e.code==='KeyC'){if(!e.repeat)cameraRig.setPreset((cameraRig.presetIndex+1)%2);return;}
 if(!keys.has(e.code)){keys.add(e.code);const control=controlKeys[e.code];if(control)recordEvent('key_down',{key:controlKeys[e.code],physicalKey:e.code,control:controlKeys[e.code]});}
});
window.addEventListener('keyup',e=>{if(gameplay.has(e.code)){e.preventDefault();if(keys.delete(e.code)){const control=controlKeys[e.code];if(control)recordEvent('key_up',{key:control,physicalKey:e.code,control});}}});
window.addEventListener('blur',()=>{clearHeldControls('window_blur');setPaused(true);});
window.addEventListener('focus',()=>{setPaused(false);setPrevious(performance.now());});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldControls('document_hidden');setPaused(document.hidden);setPrevious(performance.now());setAccumulator(0);});
function controls(){return {pitch:+keys.has('KeyW')-keys.has('KeyS'),roll:+keys.has('KeyD')-keys.has('KeyA'),yaw:+keys.has('KeyE')-keys.has('KeyQ'),brake:+keys.has('KeyB'),throttle:+(keys.has('ShiftLeft')||keys.has('ShiftRight'))-(keys.has('ControlLeft')||keys.has('ControlRight'))};}

return {controls};
}
