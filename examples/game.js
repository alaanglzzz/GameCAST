import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let scene, camera, renderer, nave;

let balas = [], enemigos = [], balasEnemigas = [], asteroides = [], explosiones = [];

let vida = 100;
let cooldownDaño = 0;

let keys = {};

let velForward = 0, velY = 0, rotY = 0;
let targetRotX = 0, targetRotZ = 0;

let LIMITE_MAPA = 500;
let maxEnemigos = 6;

const loader = new GLTFLoader();

//  AUDIO
let laserSound = new Audio('./sounds/laser.mp3');
let explosionSound = new Audio('./sounds/explosion.mp3');

window.addEventListener('click', () => {
    laserSound.play().then(()=>laserSound.pause());
    explosionSound.play().then(()=>explosionSound.pause());
}, {once:true});

init();

function init(){

scene = new THREE.Scene();

new RGBELoader().setPath('./hdr/')
.load('rogland_clear_night_4k.hdr', tex=>{
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    scene.environment = tex;
});

camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0,8,25);

renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff,1));

const light = new THREE.PointLight(0xffffff,5);
light.position.set(0,20,20);
scene.add(light);
// NAVE (CORREGIDA CON WRAPPER)
loader.load('./models/rebels_x-wing_starfighter.glb', g=>{

    const modelo = g.scene;

    const box = new THREE.Box3().setFromObject(modelo);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    modelo.scale.setScalar(5/Math.max(size.x,size.y,size.z));
    modelo.position.sub(center);

    modelo.rotation.y = Math.PI;

    //  CONTENEDOR (ESTE ES EL QUE SE MUEVE)
    nave = new THREE.Object3D();
    nave.add(modelo);

    nave.position.set(0,5,0);

    // base limpia
    nave.rotation.set(0,0,0);
    nave.userData.baseRot = nave.rotation.clone();

    scene.add(nave);
});

//  ASTEROIDES
for(let i=0;i<40;i++) crearAsteroide();

//  ENEMIGOS
for(let i=0;i<maxEnemigos;i++) crearEnemigo();

// CONTROLES
document.addEventListener('keydown', e=>{
    keys[e.key] = true;
    if(e.key === ' ') disparar();
});

document.addEventListener('keyup', e=> keys[e.key] = false);

window.addEventListener('resize', onResize);

animate();
}

// DISPARO CORRECTO (usa dirección real)
function disparar(){

    laserSound.currentTime = 0;
    laserSound.play();

    const bala = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshBasicMaterial({color:0xff0000})
    );

    //  obtener dirección REAL hacia donde apunta la nave
    const dir = new THREE.Vector3();
    nave.getWorldDirection(dir);

    //  invertir porque Three usa -Z como forward interno
    dir.multiplyScalar(-1);

    //  posición delante de la nave
    const offset = dir.clone().multiplyScalar(3);

    bala.position.copy(nave.position).add(offset);

    // velocidad
    bala.userData.vel = dir.clone().multiplyScalar(3);

    scene.add(bala);
    balas.push(bala);
}
//  ENEMIGOS
function crearEnemigo(){
loader.load('./models/caza_imperial.glb', g=>{
    let e = g.scene;

    const box = new THREE.Box3().setFromObject(e);
    const size = box.getSize(new THREE.Vector3());

    e.scale.setScalar(3/Math.max(size.x,size.y,size.z));

    e.position.set(
        Math.random()*100-50,
        Math.random()*20+5,
        Math.random()*-200
    );

    scene.add(e);
    enemigos.push(e);
});
}

//  DISPARO ENEMIGO
function disparoEnemigo(e){

const bala = new THREE.Mesh(
    new THREE.SphereGeometry(0.2),
    new THREE.MeshBasicMaterial({color:0x00ffff})
);

bala.position.copy(e.position);

const dir = nave.position.clone().sub(e.position).normalize();

bala.userData.vel = dir.multiplyScalar(5);

scene.add(bala);
balasEnemigas.push(bala);
}

//  EXPLOSIÓN
function crearExplosion(pos){

explosionSound.currentTime = 0;
explosionSound.play();

const geo = new THREE.SphereGeometry(0.5);
const mat = new THREE.MeshBasicMaterial({color:0xffaa00});

const exp = new THREE.Mesh(geo, mat);
exp.position.copy(pos);

exp.userData = { escala: 0.2 };

scene.add(exp);
explosiones.push(exp);
}

//  ASTEROIDES
function crearAsteroide(){
loader.load('./models/asteroide_low_poly.glb', g=>{
    let a = g.scene;

    a.position.set(
        Math.random()*LIMITE_MAPA - LIMITE_MAPA/2,
        Math.random()*80 - 40,
        Math.random()*LIMITE_MAPA - LIMITE_MAPA/2
    );

    let scale = 2 + Math.random()*4;
    a.scale.set(scale,scale,scale);

    a.userData.radio = scale * 1.5;

    a.userData.rot = {
        x:(Math.random()-0.5)*0.02,
        y:(Math.random()-0.5)*0.02,
        z:(Math.random()-0.5)*0.02
    };

    a.userData.mov = {
        x:(Math.random()-0.5)*0.02,
        y:(Math.random()-0.5)*0.02,
        z:(Math.random()-0.5)*0.02
    };

    scene.add(a);
    asteroides.push(a);
});
}

//  CÁMARA PRO
function updateCamera(){
    if(!nave) return;

    let offset = new THREE.Vector3(0,5,15);
    offset.applyQuaternion(nave.quaternion);

    let pos = nave.position.clone().add(offset);

    camera.position.lerp(pos,0.1);
    camera.lookAt(nave.position);
}

//  LOOP
function animate(){
requestAnimationFrame(animate);

updateCamera();

if(cooldownDaño > 0) cooldownDaño--;

// MOVIMIENTO PRO (CORREGIDO)
if(nave){

    // ADELANTE / ATRÁS (con límite)
    if(keys['w']) velForward += 0.05;
    if(keys['s']) velForward -= 0.05;

    // limitar velocidad
    velForward = Math.max(-2, Math.min(2, velForward));

    // fricción
    velForward *= 0.97;

    nave.translateZ(-velForward);


    // ARRIBA / ABAJO (suave)
    if(keys['q']) velY += 0.02;
    if(keys['e']) velY -= 0.02;

    velY *= 0.92;
    nave.position.y += velY;


    // GIRO IZQUIERDA / DERECHA (más suave)
    if(keys['a']) rotY += 0.015;
    if(keys['d']) rotY -= 0.015;

    rotY *= 0.92;
    nave.rotation.y += rotY;


    // INCLINACIÓN CONTROLADA
    targetRotX = -velY * 1.0;   // menos exagerado
    targetRotZ = -rotY * 1.5;   // más realista

    // aplicar sin romper orientación base
    nave.rotation.x = nave.userData.baseRot.x + targetRotX;
    nave.rotation.z = nave.userData.baseRot.z + targetRotZ;
}

//  ENEMIGOS
enemigos.forEach(e=>{
    if(!nave) return;

    let dir = nave.position.clone().sub(e.position).normalize();

    let dist = nave.position.distanceTo(e.position);
    let speed = dist > 20 ? 0.6 : 0.3;

    e.position.add(dir.multiplyScalar(speed));

    if(Math.random()<0.02) disparoEnemigo(e);

    if(nave.position.distanceTo(e.position)<3){
        vida -= 0.4;
    }
});

//  BALAS ENEMIGAS
for(let i=balasEnemigas.length-1;i>=0;i--){
    balasEnemigas[i].position.add(balasEnemigas[i].userData.vel);

    if(nave && balasEnemigas[i].position.distanceTo(nave.position)<2){
        vida -= 2;
        scene.remove(balasEnemigas[i]);
        balasEnemigas.splice(i,1);
    }
}
//  BALAS DEL JUGADOR
for(let i = balas.length - 1; i >= 0; i--){

    // mover bala
    balas[i].position.add(balas[i].userData.vel);

    // eliminar si se va lejos
    if(balas[i].position.length() > 500){
        scene.remove(balas[i]);
        balas.splice(i,1);
    }
}

//  COLISIONES
for(let i=balas.length-1;i>=0;i--){
    for(let j=enemigos.length-1;j>=0;j--){
        if(balas[i].position.distanceTo(enemigos[j].position)<2){

            crearExplosion(enemigos[j].position);

            scene.remove(enemigos[j]);
            scene.remove(balas[i]);

            enemigos.splice(j,1);
            balas.splice(i,1);

            if(enemigos.length<maxEnemigos){
                crearEnemigo();
            }

            break;
        }
    }
}

//  ASTEROIDES
asteroides.forEach(a=>{
    a.rotation.x += a.userData.rot.x;
    a.rotation.y += a.userData.rot.y;
    a.rotation.z += a.userData.rot.z;

    a.position.add(new THREE.Vector3(
        a.userData.mov.x,
        a.userData.mov.y,
        a.userData.mov.z
    ));

    if(nave && cooldownDaño <= 0){
        if(nave.position.distanceTo(a.position) < a.userData.radio + 2){
            vida -= 5;
            cooldownDaño = 20;
        }
    }
});

//  EXPLOSIONES
for(let i=explosiones.length-1;i>=0;i--){
    let e = explosiones[i];

    e.userData.escala += 0.2;
    e.scale.setScalar(e.userData.escala);

    e.material.opacity = 1 - (e.userData.escala/5);
    e.material.transparent = true;

    if(e.userData.escala > 5){
        scene.remove(e);
        explosiones.splice(i,1);
    }
}

// HUD
document.getElementById("hud").innerText = "Vida: " + Math.floor(vida);

renderer.render(scene,camera);
}

function onResize(){
camera.aspect = innerWidth/innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth,innerHeight);
}