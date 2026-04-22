import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
let scene, camera, renderer, nave;

let balas = [], enemigos = [], balasEnemigas = [], asteroides = [], explosiones = [];

let vida   = 100;
let escudo = 100;
let cooldownDaño   = 0;
let cooldownEscudo = 0;
let ultimoDisparo  = 0;

let keys = {};
let velForward = 0, velY = 0, rotY = 0;
let targetRotX = 0, targetRotZ = 0;

const LIMITE_MAPA = 600;
let maxEnemigos = 6;
let wave  = 1;
let score = 0;
let kills = 0;
let gameOver    = false;
let gameStarted = false;

// ─── AUDIO ────────────────────────────────────────────────────────────────────
const laserSound     = new Audio('./sounds/laser.mp3');
const explosionSound = new Audio('./sounds/explosion.mp3');
const music          = new Audio('./sounds/music.mp3');
music.loop   = true;
music.volume = 0.3;

window.addEventListener('click', () => {
    laserSound.play().then(() => laserSound.pause()).catch(() => {});
    explosionSound.play().then(() => explosionSound.pause()).catch(() => {});
    if (music.paused) { music.currentTime = 0; music.play().catch(() => {}); }
}, { once: true });

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
    // Escena
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
    camera.position.set(0, 8, 25);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    document.body.appendChild(renderer.domElement);

    // HDR
    new RGBELoader().setPath('./hdr/')
        .load('rogland_clear_night_4k.hdr', tex => {
            tex.mapping      = THREE.EquirectangularReflectionMapping;
            scene.background = tex;
            scene.environment = tex;
        });

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2);
    sun.position.set(50, 80, 30);
    scene.add(sun);
    const fill = new THREE.PointLight(0x4488ff, 3, 400);
    fill.position.set(-50, 20, -50);
    scene.add(fill);

    // Nave jugador
    loader.load('./models/rebels_x-wing_starfighter.glb', g => {
        const modelo = g.scene;
        const box    = new THREE.Box3().setFromObject(modelo);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        modelo.scale.setScalar(5 / Math.max(size.x, size.y, size.z));
        modelo.position.sub(center);
        modelo.rotation.y = Math.PI;

        nave = new THREE.Object3D();
        nave.add(modelo);
        nave.position.set(0, 5, 0);
        nave.userData.baseRot = nave.rotation.clone();
        scene.add(nave);
    });

    // Poblar mundo
    for (let i = 0; i < 40; i++) crearAsteroide();
    for (let i = 0; i < maxEnemigos; i++) crearEnemigo();

    // Controles
    document.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        keys[key] = true;
        if (key === ' ') disparar();
        if (key === 'r') location.reload();
    });
    document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', onResize);

    // Botón inicio
    document.getElementById('btn-start').addEventListener('click', () => {
        const screen = document.getElementById('start-screen');
        screen.classList.add('hidden');
        setTimeout(() => screen.remove(), 650);
        gameStarted = true;
        animate();
    });
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
function limpiarObjeto(obj) {
    scene.remove(obj);
    obj.traverse(child => {
        if (!child.isMesh) return;
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material?.dispose();
    });
}

function recibirDaño(cantidad) {
    if (escudo > 0) {
        const absorbido = Math.min(escudo, cantidad);
        escudo   -= absorbido;
        cantidad -= absorbido;
        cooldownEscudo = 120;
    }
    if (cantidad > 0) vida -= cantidad;
}

function mostrarWaveBanner(texto) {
    const banner = document.getElementById('wave-banner');
    if (!banner) return;
    banner.textContent = texto;
    banner.style.opacity = '1';
    setTimeout(() => { banner.style.opacity = '0'; }, 2200);
}

// ─── DISPARO JUGADOR ──────────────────────────────────────────────────────────
const balaMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
const balaGeo = new THREE.SphereGeometry(0.2, 6, 6);

function disparar() {
    if (!nave || gameOver || !gameStarted) return;
    const ahora = Date.now();
    if (ahora - ultimoDisparo < 200) return;
    ultimoDisparo = ahora;

    const snd = laserSound.cloneNode();
    snd.volume = 0.4;
    snd.play().catch(() => {});

    const dir = new THREE.Vector3();
    nave.getWorldDirection(dir);
    dir.multiplyScalar(-1);

    [new THREE.Vector3(-1.1, 0, 3), new THREE.Vector3(1.1, 0, 3)].forEach(offset => {
        const bala = new THREE.Mesh(balaGeo, balaMat);
        offset.applyQuaternion(nave.quaternion);
        bala.position.copy(nave.position).add(offset);
        bala.userData.vel        = dir.clone().multiplyScalar(5);
        bala.userData.posInicial = bala.position.clone();
        scene.add(bala);
        balas.push(bala);
    });
}

// ─── ENEMIGOS ─────────────────────────────────────────────────────────────────
function crearEnemigo() {
    loader.load('./models/caza_imperial.glb', g => {
        const e   = g.scene;
        const box = new THREE.Box3().setFromObject(e);
        const sz  = box.getSize(new THREE.Vector3());
        e.scale.setScalar(3 / Math.max(sz.x, sz.y, sz.z));

        const angle = Math.random() * Math.PI * 2;
        const dist  = 80 + Math.random() * 120;
        e.position.set(
            (nave?.position.x ?? 0) + Math.cos(angle) * dist,
            Math.random() * 20 + 2,
            (nave?.position.z ?? 0) + Math.sin(angle) * dist
        );
        e.userData.shootTimer = Math.random() * 60;

        scene.add(e);
        enemigos.push(e);
    });
}

// ─── BALAS ENEMIGAS ───────────────────────────────────────────────────────────
const balaEnemMat = new THREE.MeshBasicMaterial({ color: 0x00eeff });
const balaEnemGeo = new THREE.SphereGeometry(0.18, 6, 6);

function disparoEnemigo(e) {
    if (!nave) return;
    const bala = new THREE.Mesh(balaEnemGeo, balaEnemMat);
    bala.position.copy(e.position);
    const dir = nave.position.clone().sub(e.position).normalize();
    bala.userData.vel = dir.multiplyScalar(4.5 + wave * 0.15);
    scene.add(bala);
    balasEnemigas.push(bala);
}

// ─── EXPLOSIÓN ────────────────────────────────────────────────────────────────
function crearExplosion(pos) {
    const snd = explosionSound.cloneNode();
    snd.volume = 0.5;
    snd.play().catch(() => {});

    for (let i = 0; i < 14; i++) {
        const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.28, 5, 5);
        const mat = new THREE.MeshBasicMaterial({
            color: [0xffcc00, 0xff6600, 0xff2200][Math.floor(Math.random() * 3)],
            transparent: true
        });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        const spd = 0.3 + Math.random() * 0.9;
        p.userData.vel = new THREE.Vector3(
            (Math.random() - 0.5) * spd,
            (Math.random() - 0.5) * spd,
            (Math.random() - 0.5) * spd
        );
        p.userData.esParticula = true;
        scene.add(p);
        explosiones.push(p);
    }
}

// ─── ASTEROIDES ───────────────────────────────────────────────────────────────
function crearAsteroide() {
    loader.load('./models/asteroide_low_poly.glb', g => {
        const a    = g.scene;
        const half = LIMITE_MAPA / 2;

        a.position.set(
            Math.random() * LIMITE_MAPA - half,
            Math.random() * 80 - 40,
            Math.random() * LIMITE_MAPA - half
        );
        const sc = 2 + Math.random() * 4;
        a.scale.set(sc, sc, sc);
        a.userData.radio = sc * 1.5;
        a.userData.rot = {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        };
        a.userData.mov = {
            x: (Math.random() - 0.5) * 0.015,
            y: (Math.random() - 0.5) * 0.015,
            z: (Math.random() - 0.5) * 0.015
        };
        scene.add(a);
        asteroides.push(a);
    });
}

// ─── CÁMARA ───────────────────────────────────────────────────────────────────
function updateCamera() {
    if (!nave) return;
    const boom   = 12 + Math.abs(velForward) * 5;
    const offset = new THREE.Vector3(0, 5, boom);
    offset.applyQuaternion(nave.quaternion);
    camera.position.lerp(nave.position.clone().add(offset), 0.07);
    camera.lookAt(nave.position);
}

// ─── ACTUALIZAR HUD ───────────────────────────────────────────────────────────
function updateHUD() {
    // Barra de vida
    const hpBar = document.getElementById('barra-vida');
    if (hpBar) {
        hpBar.style.width = Math.max(0, vida) + '%';
        hpBar.classList.toggle('critical', vida < 25);
    }

    // Barra de escudo
    const shldBar = document.getElementById('barra-escudo');
    if (shldBar) shldBar.style.width = Math.max(0, escudo) + '%';

    // Score
    const scoreEl = document.getElementById('score-val');
    if (scoreEl) scoreEl.textContent = score.toLocaleString();

    // Bajas
    const killsEl = document.getElementById('kills-val');
    if (killsEl) killsEl.textContent = `BAJAS: ${kills}`;

    // Oleada
    const waveEl = document.getElementById('wave-val');
    if (waveEl) waveEl.textContent = `OLEADA ${wave}`;

    // Velocímetro
    const velEl = document.getElementById('vel-num');
    if (velEl) velEl.textContent = Math.abs(Math.round(velForward * 50));
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function mostrarGameOver() {
    // Ocultar HUD y elementos de juego
    ['hud', 'crosshair', 'info', 'wave-banner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const screen = document.createElement('div');
    screen.id = 'gameover-screen';
    screen.innerHTML = `
        <h1>GAME OVER</h1>
        <div class="stat-row">PUNTUACIÓN <span class="stat-num">${score.toLocaleString()}</span></div>
        <div class="stat-row">BAJAS <span class="stat-num">${kills}</span></div>
        <div class="stat-row">OLEADA ALCANZADA <span class="stat-num">${wave}</span></div>
        <button id="btn-restart">REINICIAR</button>
        <div class="restart-hint">O PRESIONA R</div>
    `;
    document.body.appendChild(screen);

    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
    document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') location.reload(); });
}

// ─── LOOP PRINCIPAL ───────────────────────────────────────────────────────────
function animate() {
    if (gameOver || !gameStarted) return;
    requestAnimationFrame(animate);

    updateCamera();

    // Cooldowns
    if (cooldownDaño   > 0) cooldownDaño--;
    if (cooldownEscudo > 0) cooldownEscudo--;

    // Regeneración pasiva
    if (escudo < 100 && cooldownEscudo <= 0) escudo = Math.min(100, escudo + 0.08);
    if (vida   < 100)                         vida   = Math.min(100, vida   + 0.01);

    // Disparo automático con espacio mantenido
    if (keys[' ']) disparar();

    // ── Movimiento ──
    if (nave) {
        if (keys['w']) velForward += 0.06;
        if (keys['s']) velForward -= 0.06;
        velForward = Math.max(-2.5, Math.min(2.5, velForward));
        velForward *= 0.97;
        nave.translateZ(-velForward);

        if (keys['q']) velY += 0.025;
        if (keys['e']) velY -= 0.025;
        velY *= 0.92;
        nave.position.y = Math.max(-30, Math.min(80, nave.position.y + velY));

        if (keys['a']) rotY += 0.018;
        if (keys['d']) rotY -= 0.018;
        rotY *= 0.92;
        nave.rotation.y += rotY;

        targetRotX = THREE.MathUtils.lerp(targetRotX, -velY * 1.2, 0.1);
        targetRotZ = THREE.MathUtils.lerp(targetRotZ, -rotY * 2.0, 0.1);
        nave.rotation.x = nave.userData.baseRot.x + targetRotX;
        nave.rotation.z = nave.userData.baseRot.z + targetRotZ;
    }

    // ── Enemigos ──
    const escalaKills = 1 + kills * 0.04;
    for (let i = enemigos.length - 1; i >= 0; i--) {
        const e = enemigos[i];
        if (!nave) continue;

        const dir  = nave.position.clone().sub(e.position).normalize();
        const dist = nave.position.distanceTo(e.position);
        const spd  = (dist > 20 ? 0.55 : 0.25) * escalaKills;

        e.position.addScaledVector(dir, spd);
        e.lookAt(nave.position);

        e.userData.shootTimer = (e.userData.shootTimer ?? 60) - 1;
        if (e.userData.shootTimer <= 0) {
            disparoEnemigo(e);
            e.userData.shootTimer = Math.max(20, 60 - kills * 2);
        }

        if (dist < 3 && cooldownDaño <= 0) {
            recibirDaño(12);
            cooldownDaño = 30;
        }
    }

    // ── Balas enemigas ──
    for (let i = balasEnemigas.length - 1; i >= 0; i--) {
        const b = balasEnemigas[i];
        b.position.add(b.userData.vel);

        if (nave && b.position.distanceTo(nave.position) < 2.2) {
            recibirDaño(6);
            limpiarObjeto(b);
            balasEnemigas.splice(i, 1);
        } else if (!nave || b.position.distanceTo(nave.position) > 700) {
            limpiarObjeto(b);
            balasEnemigas.splice(i, 1);
        }
    }

    // ── Balas jugador (mover + rango) ──
    for (let i = balas.length - 1; i >= 0; i--) {
        balas[i].position.add(balas[i].userData.vel);
        if (balas[i].position.distanceTo(balas[i].userData.posInicial) > 600) {
            limpiarObjeto(balas[i]);
            balas.splice(i, 1);
        }
    }

    // ── Colisiones balas jugador ──
    for (let i = balas.length - 1; i >= 0; i--) {
        if (!balas[i]) continue;
        let hit = false;

        // vs enemigos
        for (let j = enemigos.length - 1; j >= 0; j--) {
            if (balas[i].position.distanceTo(enemigos[j].position) < 3.5) {
                crearExplosion(enemigos[j].position);
                scene.remove(enemigos[j]);
                limpiarObjeto(balas[i]);
                enemigos.splice(j, 1);
                balas.splice(i, 1);
                hit = true;

                score += 100 + wave * 10;
                kills++;

                // Subir oleada cada 10 kills
                const nuevaWave = Math.floor(kills / 10) + 1;
                if (nuevaWave > wave) {
                    wave = nuevaWave;
                    maxEnemigos = 6 + wave * 2;
                    mostrarWaveBanner(`OLEADA ${wave}`);
                }

                // Mantener cantidad de enemigos
                if (enemigos.length < maxEnemigos) crearEnemigo();
                break;
            }
        }

        // vs asteroides
        if (!hit) {
            for (let k = asteroides.length - 1; k >= 0; k--) {
                if (balas[i] && balas[i].position.distanceTo(asteroides[k].position) < asteroides[k].userData.radio) {
                    crearExplosion(balas[i].position);
                    limpiarObjeto(balas[i]);
                    balas.splice(i, 1);
                    break;
                }
            }
        }
    }

    // ── Asteroides ──
    asteroides.forEach(a => {
        a.rotation.x += a.userData.rot.x;
        a.rotation.y += a.userData.rot.y;
        a.rotation.z += a.userData.rot.z;
        a.position.x  += a.userData.mov.x;
        a.position.y  += a.userData.mov.y;
        a.position.z  += a.userData.mov.z;

        // Reposicionar si se aleja demasiado
        if (nave && a.position.distanceTo(nave.position) > LIMITE_MAPA) {
            const angle = Math.random() * Math.PI * 2;
            const dist  = 100 + Math.random() * 200;
            a.position.set(
                nave.position.x + Math.cos(angle) * dist,
                nave.position.y + (Math.random() - 0.5) * 80,
                nave.position.z + Math.sin(angle) * dist
            );
        }

        if (nave && cooldownDaño <= 0 && nave.position.distanceTo(a.position) < a.userData.radio + 2) {
            recibirDaño(18);
            cooldownDaño = 25;
        }
    });

    // ── Partículas de explosión ──
    for (let i = explosiones.length - 1; i >= 0; i--) {
        const e = explosiones[i];
        if (e.userData.esParticula) {
            e.position.add(e.userData.vel);
            e.userData.vel.multiplyScalar(0.93);
            e.material.opacity -= 0.03;
            if (e.material.opacity <= 0) {
                limpiarObjeto(e);
                explosiones.splice(i, 1);
            }
        }
    }

    // ── Game Over ──
    if (vida <= 0 && !gameOver) {
        gameOver = true;
        mostrarGameOver();
        return;
    }

    updateHUD();
    renderer.render(scene, camera);
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

// ─── ARRANCAR ─────────────────────────────────────────────────────────────────
init();
