export const controlKeys={KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',KeyQ:'Q',KeyE:'E',KeyB:'Brake',ArrowUp:'Up',ArrowDown:'Down',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl'};
export function createKeyboard({keys,recordEvent,clearHeldControls,reset,cameraRig,setPaused,setPrevious,setAccumulator}){
const arrowKeys=new Set(['ArrowUp','ArrowDown']);
const formFocus=()=>document.activeElement?.closest?.('input,select,textarea,[contenteditable]');
let lastGameplayKeydown=null;
const gameplay=new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyC','KeyR','KeyB','ArrowUp','ArrowDown']);
window.addEventListener('keydown',e=>{
 if(!gameplay.has(e.code)||arrowKeys.has(e.code)&&formFocus())return;lastGameplayKeydown={code:e.code,repeat:!!e.repeat,timeMs:performance.now()};e.preventDefault();
 if(e.code==='KeyR'){if(!e.repeat)reset();return;}
 if(e.code==='KeyC'){if(!e.repeat)cameraRig.setPreset((cameraRig.presetIndex+1)%2);return;}
 if(!keys.has(e.code)){keys.add(e.code);const control=controlKeys[e.code];if(control)recordEvent('key_down',{key:controlKeys[e.code],physicalKey:e.code,control:controlKeys[e.code]});}
});
window.addEventListener('keyup',e=>{if(gameplay.has(e.code)){if(!(arrowKeys.has(e.code)&&formFocus()))e.preventDefault();if(keys.delete(e.code)){const control=controlKeys[e.code];if(control)recordEvent('key_up',{key:control,physicalKey:e.code,control});}}});
document.addEventListener('focusin',()=>{if(formFocus())for(const code of arrowKeys)if(keys.delete(code))recordEvent('key_up',{key:controlKeys[code],physicalKey:code,control:controlKeys[code]});});
window.addEventListener('blur',()=>{clearHeldControls('window_blur');setPaused(true);});
window.addEventListener('focus',()=>{setPaused(false);setPrevious(performance.now());});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldControls('document_hidden');setPaused(document.hidden);setPrevious(performance.now());setAccumulator(0);});
function controls(){return {pitch:+keys.has('KeyW')-keys.has('KeyS'),roll:+keys.has('KeyD')-keys.has('KeyA'),yaw:+keys.has('KeyE')-keys.has('KeyQ'),brake:+keys.has('KeyB'),throttle:+(keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('ArrowUp'))-(keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('ArrowDown'))};}

return {controls,getDebugState:()=>({heldGameplayKeys:[...keys].filter(code=>gameplay.has(code)),controls:controls(),lastGameplayKeydown:lastGameplayKeydown?{...lastGameplayKeydown}:null})};
}
