import * as THREE from '../vendor/three.js';
import {WATER_LEVEL_M} from '../world/height.js';
export function createScene($){
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xb5cbd1,3200,13000);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
$('view').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Flight simulation');
const camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.25,40000);
scene.add(new THREE.HemisphereLight(0xe2f1ff,0x60734d,2.3));
const sun=new THREE.DirectionalLight(0xffecd0,2.6);sun.position.set(-2500,4500,-1600);scene.add(sun);
const sky=new THREE.Mesh(new THREE.SphereGeometry(26000,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=max(0.0,d.y);vec3 c=mix(vec3(.70,.80,.83),vec3(.22,.43,.62),pow(h,.58));float s=pow(max(0.0,dot(d,normalize(vec3(-.5,.7,-.35)))),1300.0);c+=vec3(.65,.48,.25)*s;gl_FragColor=vec4(c,1.);}`}));scene.add(sky);
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(65000,65000),new THREE.MeshStandardMaterial({color:0x71999e,roughness:.8,metalness:.1}));ocean.rotation.x=-Math.PI/2;ocean.position.y=WATER_LEVEL_M;scene.add(ocean);

return {scene,renderer,camera,sky,ocean};
}
