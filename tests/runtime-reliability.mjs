import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.js';
import {Flight} from '../src/physics/Flight.js';
import {Atmosphere} from '../src/physics/atmosphere.js';
import {ground} from '../src/world/height.js';
import {createRecorder} from '../src/telemetry/recorder.js';
import {createCamera} from '../src/rendering/camera.js';
import {createKeyboard} from '../src/controls/keyboard.js';
import {createInterface} from '../src/ui/interface.js';

const nodes=new Map(),events=new Map();let created=0;
function node(id=''){
 if(!nodes.has(id))nodes.set(id,{id,textContent:'',value:'',disabled:false,hidden:false,dataset:{},style:{setProperty(){}},
  classList:{toggle(){}},addEventListener(type,fn){(this.handlers??={})[type]=fn},
  click(){this.handlers?.click?.({preventDefault(){}})},appendChild(){},setAttribute(){}});
 return nodes.get(id);
}
const $=node;
globalThis.document={hidden:false,createElement:()=>node('created-'+created++),querySelectorAll:()=>[],addEventListener(){}};
globalThis.window={addEventListener(type,fn){(events.get(type)??events.set(type,[]).get(type)).push(fn)}};
globalThis.HTMLButtonElement=class {};HTMLButtonElement.prototype.commandForElement=null;
globalThis.HTMLElement=class {};HTMLElement.prototype.popover=null;
const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
let downloaded=null;URL.createObjectURL=blob=>{downloaded=blob;return 'blob:flight-test'};URL.revokeObjectURL=()=>{};
const sim=new Flight(),keys=new Set(),renderer={domElement:node('canvas'),info:{render:{calls:17,triangles:2300}}};
const recorder=createRecorder({sim,keys,renderer,ground,$,isPaused:()=>false});
const cameraRig=createCamera({camera:new THREE.PerspectiveCamera(),plane:new THREE.Group(),sky:new THREE.Group(),surfaceHeight:()=>0,$});
const keyboard=createKeyboard({keys,recordEvent:recorder.recordEvent,clearHeldControls:recorder.clearHeldControls,reset:()=>{},cameraRig,setPaused(){},setPrevious(){},setAccumulator(){}});
const ui=createInterface({sim,atmosphere:new Atmosphere('off'),...recorder,reset:()=>{},cameraRig,renderer,$});
ui.updateHud(.1);assert.equal(node('heading-number').textContent,'000°');
assert.equal(node('terrain-diagnostics').hidden,true);
node('show-terrain-debug').checked=true;node('show-terrain-debug').handlers.change();ui.updateHud(.1);
assert.match(node('terrain-diag-height').textContent,/ m$/);
node('show-terrain-debug').checked=false;node('show-terrain-debug').handlers.change();assert.equal(node('terrain-diagnostics').hidden,true);
const tick=(effect=null,alpha=null,speed=null,vertical=null)=>{
 if(effect!==null)sim.stall=effect;
 if(alpha!==null){sim.alpha=alpha;sim.diagnostics.alpha=alpha}
 if(speed!==null)sim.v.set(0,vertical??sim.v.y,speed);
 if(vertical!==null){sim.v.y=vertical;sim.p.y+=vertical/120}
 sim.time+=1/120;recorder.recordTick(false,1/120);
};
const many=(count,...state)=>{for(let i=0;i<count;i++)tick(...state)};
const start=()=>node('record-start').click(),stop=()=>node('record-stop').click();
const discard=()=>node('record-discard').click();
const key=(type,code,repeat=false)=>events.get(type)[0]({code,repeat,preventDefault(){}});
const critical=sim.profile.critical;

assert.equal(cameraRig.presetIndex,0);cameraRig.syncCamera(true);
key('keydown','KeyC');assert.equal(cameraRig.presetIndex,1);assert.equal(cameraRig.cameraSettings.distance,38);
key('keydown','KeyC');assert.equal(cameraRig.presetIndex,0);assert.equal(cameraRig.cameraSettings.distance,17);
recorder.updateDiagnostics(1000,1/60);assert.notEqual(node('diag-average').textContent,'');

// Normal flight, one held key transition, UI states and export.
start();assert.equal(recorder.recorder.active,true);assert.equal(node('record-stop').disabled,false);
key('keydown','KeyW');key('keydown','KeyW',true);many(25);key('keyup','KeyW');stop();
let data=recorder.recorder.data;
assert.equal(recorder.recorder.active,false);assert.equal(node('record-stop').disabled,true);assert.equal(node('record-export').disabled,false);
assert.ok(data.summary?.stallDiagnosticsSummary);assert.equal(data.samples.length,2);
assert.equal(data.events.filter(e=>e.type==='key_down').length,1);assert.equal(data.events.filter(e=>e.type==='key_up').length,1);
assert.equal(data.events.at(-1).type,'recording_stopped');
node('record-export').click();const exported=JSON.parse(await downloaded.text());
assert.equal(exported.samples.length,2);assert.ok(exported.summary.stallDiagnosticsSummary);
start();assert.equal(recorder.recorder.data,data);assert.match(node('recorder-message').textContent,/Export or discard/);
discard();assert.equal(recorder.recorder.data,null);

// The response control uses the existing coalesced tuning event and stop flush.
start();node('turbulence-response').value='1.5';node('turbulence-response').handlers.input();many(13);stop();
assert.equal(sim.turbulenceResponse,1.5);
const responseEvent=recorder.recorder.data.events.find(e=>e.type==='tuning_changed'&&e.parameter==='turbulenceResponse');
assert.equal(responseEvent.newValue,1.5);assert.equal(responseEvent.configuration.airflowResponse.responseScale,1.5);
discard();sim.turbulenceResponse=1;

// One swept terrain contact records its pre-reset location, then leaves flight playable.
sim.reset();sim.p.set(700,ground(700,4400)+8,4400);sim.v.set(0,-120,0);start();
let impacted=false;for(let i=0;i<30&&!impacted;i++){impacted=sim.step(1/120);recorder.recordTick(impacted,1/120)}
assert.equal(impacted,true);ui.updateHud(.1);assert.equal(node('terrain-impact').hidden,false);
assert.match(node('terrain-impact').textContent,/Terrain impact/);ui.updateHud(4.1);assert.equal(node('terrain-impact').hidden,true);
for(let i=0;i<3;i++){const didReset=sim.step(1/120);recorder.recordTick(didReset,1/120)}stop();
const contacts=recorder.recorder.data.events.filter(e=>e.type==='ground_contact');assert.equal(contacts.length,1);
assert.equal(contacts[0].impact.surface,'terrain');assert.ok(contacts[0].impact.positionM[0]>0);
assert.equal(contacts[0].state.positionM[0],-1200);assert.ok(recorder.recorder.data.summary);discard();

// Developed stall, nose-down aerodynamic recovery while still descending.
sim.reset();recorder.resetStallDiagnosticState();start();many(12,0,0,36,0);
many(14,.45,critical+.12,21,-8);
many(12,.29,0,25,-6);many(12,.04,0,29,-4);stop();
data=recorder.recorder.data;let summary=data.summary.stallDiagnosticsSummary;
assert.equal(summary.developedStallEpisodeCount,1);assert.equal(summary.completedDevelopedStallRecoveryCount,1);
assert.equal(summary.developedStallEpisodes[0].incomplete,false);
assert.equal(summary.recoveryEpisodes[0].complete,true);
assert.ok(summary.recoveryEpisodes[0].minimumVerticalSpeedMps<=-6);
assert.ok(summary.recoveryEpisodes[0].maximumAirspeedMps>=25);
assert.ok(data.events.some(e=>e.type==='stall_recovery_complete'&&e.state.verticalSpeedMps<0));
discard();

// Stopping inside developed stall retains an explicitly incomplete episode.
sim.reset();recorder.resetStallDiagnosticState();start();many(12,.5,critical+.12,20,-7);stop();
summary=recorder.recorder.data.summary.stallDiagnosticsSummary;
assert.equal(summary.developedStallEpisodes.length,1);
assert.equal(summary.developedStallEpisodes[0].incomplete,true);
assert.equal(summary.developedStallEpisodes[0].incompleteReason,'recording_stopped_before_aerodynamic_recovery');
assert.equal(summary.completedDevelopedStallRecoveryCount,0);discard();

// A mid-recovery stop reports the actual recovery interval and incompleteness.
sim.reset();recorder.resetStallDiagnosticState();start();many(12,.5,critical+.12,20,-7);many(12,.29,0,24,-5);stop();
summary=recorder.recorder.data.summary.stallDiagnosticsSummary;
assert.equal(summary.recoveryEpisodes[0].incomplete,true);
assert.ok(summary.recoveryEpisodes[0].minimumVerticalSpeedMps<=-5);discard();

// If an unexpected summary calculation fails, the raw recording remains usable.
sim.reset();recorder.resetStallDiagnosticState();
const originalError=console.error;let reportedError=false;
console.error=()=>{reportedError=true};
start();many(25);recorder.recorder.performanceIntervals=null;stop();
console.error=originalError;assert.equal(reportedError,true);
assert.equal(recorder.recorder.active,false);assert.equal(node('record-stop').disabled,true);
assert.equal(node('record-export').disabled,false);assert.equal(recorder.recorder.data.summary,null);
assert.match(node('recorder-message').textContent,/Summary failed/);
assert.ok(recorder.recorder.data.samples.length);discard();recorder.recorder.performanceIntervals=[];
// The sample cap must stop once, even though the stop event refreshes the UI.
sim.reset();recorder.resetStallDiagnosticState();recorder.recorder.maxSamples=2;
start();many(26);assert.equal(recorder.recorder.active,false);
assert.equal(recorder.recorder.data.events.filter(e=>e.type==='recording_stopped').length,1);
assert.ok(recorder.recorder.data.summary);discard();
URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
console.log('runtime reliability: recorder lifecycle, recovery summaries, export, keyboard, diagnostics and camera presets passed');
