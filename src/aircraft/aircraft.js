import * as THREE from '../vendor/three.js';
import {GLTFLoader} from '../vendor/three.js';
export function createAircraft({sim,scene,$,onLoaded}){
let loaded=false;
const plane=new THREE.Group();scene.add(plane);let propeller,elevator,elevatorRest;
// Model rests at an 11.51 degree nose-up angle. Remove the ground pose,
// then move the flight pivot onto the wing root near the center of mass.
const center=new THREE.Group();center.position.set(0,-1.35,-.85);plane.add(center);
const leveled=new THREE.Group();leveled.rotation.x=Math.asin(.1995513101349667);center.add(leveled);
new GLTFLoader().load('./assets/models/aircraft.glb',gltf=>{
 leveled.add(gltf.scene);propeller=gltf.scene.getObjectByName('propeller');
 gltf.scene.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
 elevator=gltf.scene.getObjectByName('elevator');elevatorRest=elevator?.quaternion.clone();
 // The rudder node includes the complete vertical fin; keep that assembly static.
 loaded=true;plane.position.copy(sim.p);plane.quaternion.copy(sim.q);onLoaded();$('loading').remove();
},undefined,error=>{console.error(error);$('loading').textContent='Aircraft could not load. Please reopen the page.';});

return {plane,get loaded(){return loaded},updateVisual(dt){if(propeller)propeller.rotateZ(dt*(22+sim.throttle*105));if(elevator){elevator.quaternion.copy(elevatorRest);elevator.rotateX(-sim.input.pitch*.24);}}};
}
