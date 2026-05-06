import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ═════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN (modificada por el menú)
// ═════════════════════════════════════════════════════════════════════════════
const CONFIG = {
    bulletColor:     0xff2200,
    crosshairColor:  '#00e5ff',
    difficulty:      'normal',   // easy | normal | hard
    volMusic:        0.30,
    volSfx:          0.60,
};

// Multiplicadores de dificultad
const DIFF = {
    easy:   { enemySpd: 0.6, enemyDmg: 0.6, spawnRate: 0.7 },
    normal: { enemySpd: 1.0, enemyDmg: 1.0, spawnRate: 1.0 },
    hard:   { enemySpd: 1.5, enemyDmg: 1.5, spawnRate: 1.4 },
};

// ═════════════════════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ═════════════════════════════════════════════════════════════════════════════
const gltfLoader = new GLTFLoader();

let scene, camera, renderer, nave;

let balas         = [];
let enemigos      = [];
let balasEnem     = [];
let asteroides    = [];
let particulas    = [];
let misilesList   = [];
let powerupOrbs   = [];
let bossRef       = null;

let vida          = 100;
let escudo        = 100;
let cdDaño        = 0;
let cdEscudo      = 0;
let cdDisparo     = 0;
let cdMisil       = 0;
let misiles       = 3;

let keys          = {};
let velF = 0, velY = 0, rotY = 0;
let tRotX = 0, tRotZ = 0;

const MAP_LIMIT    = 700;
let maxEnemigos    = 6;
let wave           = 1;
let score          = 0;
let kills          = 0;
let gameOver       = false;
let gameRunning    = false;   // ← SE ACTIVA AL PULSAR JUGAR

let bossActivo    = false;
let bossVida      = 0;
let bossMaxVida   = 0;
let bossFase      = 1;

let combo         = 1;
let comboTimer    = 0;
const COMBO_MS    = 180;

let powerupActivo  = null;
const PU_DUR       = 600;

let frame          = 0;

// ═════════════════════════════════════════════════════════════════════════════
//  AUDIO
// ═════════════════════════════════════════════════════════════════════════════
const sndLaser = new Audio('./sounds/laser.mp3');
const sndExpl  = new Audio('./sounds/explosion.mp3');
const sndMusic = new Audio('./sounds/music.mp3');
sndMusic.loop   = true;
sndMusic.volume = CONFIG.volMusic;

function playLaser()    { const s = sndLaser.cloneNode(); s.volume = CONFIG.volSfx * 0.6; s.play().catch(()=>{}); }
function playExplosion(big=false) { const s = sndExpl.cloneNode(); s.volume = CONFIG.volSfx * (big ? 1 : 0.7); s.play().catch(()=>{}); }

// ═════════════════════════════════════════════════════════════════════════════
//  MENÚ — lógica de botones y personalización
// ═════════════════════════════════════════════════════════════════════════════
function setupMenu() {
    // Canvas de estrellas del menú
    const starsCanvas = document.getElementById('stars-canvas');
    drawMenuStars(starsCanvas);

    // Botones principales
    document.getElementById('btn-play').addEventListener('click', startGame);

    document.getElementById('btn-customize').addEventListener('click', () => {
        document.getElementById('panel-customize').classList.add('open');
    });
    document.getElementById('close-customize').addEventListener('click', () => {
        document.getElementById('panel-customize').classList.remove('open');
    });

    document.getElementById('btn-controls').addEventListener('click', () => {
        document.getElementById('panel-controls').classList.add('open');
    });
    document.getElementById('close-controls').addEventListener('click', () => {
        document.getElementById('panel-controls').classList.remove('open');
    });

    // Colores de bala
    document.querySelectorAll('#bullet-colors .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('#bullet-colors .color-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            CONFIG.bulletColor = parseInt(sw.dataset.color, 16);
            // Actualizar material en tiempo real si ya está en juego
            if (balaMat) balaMat.color.setHex(CONFIG.bulletColor);
        });
    });

    // Colores de crosshair
    document.querySelectorAll('#crosshair-colors .color-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            document.querySelectorAll('#crosshair-colors .color-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            CONFIG.crosshairColor = '#' + sw.dataset.color;
            document.documentElement.style.setProperty('--crosshair-color', CONFIG.crosshairColor);
        });
    });

    // Dificultad
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            CONFIG.difficulty = btn.dataset.diff;
        });
    });

    // Sliders de volumen
    const volMusicSlider = document.getElementById('vol-music');
    const volMusicVal    = document.getElementById('vol-music-val');
    volMusicSlider.addEventListener('input', () => {
        CONFIG.volMusic = volMusicSlider.value / 100;
        sndMusic.volume = CONFIG.volMusic;
        volMusicVal.textContent = volMusicSlider.value + '%';
    });

    const volSfxSlider = document.getElementById('vol-sfx');
    const volSfxVal    = document.getElementById('vol-sfx-val');
    volSfxSlider.addEventListener('input', () => {
        CONFIG.volSfx = volSfxSlider.value / 100;
        volSfxVal.textContent = volSfxSlider.value + '%';
    });

    // Aplicar crosshair color inicial
    document.documentElement.style.setProperty('--crosshair-color', CONFIG.crosshairColor);
}

function drawMenuStars(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5,
        speed: 0.05 + Math.random() * 0.15,
        opacity: 0.3 + Math.random() * 0.7,
    }));

    function tick() {
        if (gameRunning) return; // dejar de animar si ya empezó el juego
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(s => {
            s.y += s.speed;
            if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
            ctx.fill();
        });
        requestAnimationFrame(tick);
    }
    tick();
}

function startGame() {
    // Desbloquear audio
    sndLaser.play().then(() => sndLaser.pause()).catch(() => {});
    sndExpl.play().then()  .catch(() => {});
    sndMusic.currentTime = 0;
    sndMusic.play().catch(() => {});

    // Ocultar menú
    const menu = document.getElementById('main-menu');
    menu.classList.add('fade-out');
    setTimeout(() => { menu.style.display = 'none'; }, 750);

    // Mostrar HUD
    ['hud','info','missile-hud','crosshair'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });

    gameRunning = true;
    updateMissileHUD();
    loop();
}

// ═════════════════════════════════════════════════════════════════════════════
//  THREE.JS INIT
// ═════════════════════════════════════════════════════════════════════════════
function initThree() {
    scene  = new THREE.Scene();
    scene.background = new THREE.Color(0x000008);

    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
    camera.position.set(0, 8, 25);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    // ── CRÍTICO: canvas al fondo de todo ──────────────────────────────────
    const cvs = renderer.domElement;
    cvs.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;';
    document.body.insertBefore(cvs, document.body.firstChild);

    // HDR (no bloqueante)
    new RGBELoader().setPath('./hdr/').load(
        'rogland_clear_night_4k.hdr',
        tex => {
            tex.mapping = THREE.EquirectangularReflectionMapping;
            scene.background  = tex;
            scene.environment = tex;
        },
        undefined,
        () => console.warn('HDR no cargado — fondo negro')
    );

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2);
    sun.position.set(50, 80, 30);
    scene.add(sun);
    const fill = new THREE.PointLight(0x4488ff, 3, 400);
    fill.position.set(-50, 20, -50);
    scene.add(fill);

    // Nave jugador
    gltfLoader.load('./models/rebels_x-wing_starfighter.glb', g => {
        const m   = g.scene;
        const box = new THREE.Box3().setFromObject(m);
        const sz  = box.getSize(new THREE.Vector3());
        const c   = box.getCenter(new THREE.Vector3());
        m.scale.setScalar(5 / Math.max(sz.x, sz.y, sz.z));
        m.position.sub(c);
        m.rotation.y = Math.PI;

        nave = new THREE.Object3D();
        nave.add(m);
        nave.position.set(0, 5, 0);
        nave.userData.baseRot = nave.rotation.clone();
        scene.add(nave);
    });

    // Mundo
    for (let i = 0; i < 40; i++) spawnAsteroide();
    for (let i = 0; i < maxEnemigos; i++) spawnEnemigo();

    // Controles
    document.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if (k === 'r' && gameRunning) location.reload();
    });
    document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    // Preview render (para ver la escena detrás del menú)
    previewRender();
}

function previewRender() {
    if (gameRunning) return;
    requestAnimationFrame(previewRender);
    renderer.render(scene, camera);
}

// ═════════════════════════════════════════════════════════════════════════════
//  MATERIALES REUTILIZABLES
// ═════════════════════════════════════════════════════════════════════════════
const balaMat      = new THREE.MeshBasicMaterial({ color: CONFIG.bulletColor });
const balaGeo      = new THREE.SphereGeometry(0.2, 6, 6);
const balaTriMat   = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
const balaEnemMat  = new THREE.MeshBasicMaterial({ color: 0x00eeff });
const balaEnemGeo  = new THREE.SphereGeometry(0.18, 6, 6);
const misilMat     = new THREE.MeshBasicMaterial({ color: 0xff9900 });
const misilGeo     = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6);

// ═════════════════════════════════════════════════════════════════════════════
//  DISPARO JUGADOR
// ═════════════════════════════════════════════════════════════════════════════
function disparar() {
    if (!nave || !gameRunning || gameOver) return;
    const cd = powerupActivo?.tipo === 'rapido' ? 5 : 12; // frames
    if (cdDisparo > 0) return;
    cdDisparo = cd;

    playLaser();

    const dir = new THREE.Vector3();
    nave.getWorldDirection(dir);
    dir.multiplyScalar(-1);

    const esT = powerupActivo?.tipo === 'triple';
    const mat  = esT ? balaTriMat : balaMat;
    mat.color.setHex(esT ? 0x00ffcc : CONFIG.bulletColor);

    const offsets = [new THREE.Vector3(-1.1, 0, 3), new THREE.Vector3(1.1, 0, 3)];
    if (esT) offsets.push(new THREE.Vector3(0, 0.5, 3));

    offsets.forEach(off => {
        const b = new THREE.Mesh(balaGeo, mat);
        off.applyQuaternion(nave.quaternion);
        b.position.copy(nave.position).add(off);
        b.userData.vel  = dir.clone().multiplyScalar(5);
        b.userData.ori  = b.position.clone();
        scene.add(b);
        balas.push(b);
    });
}

// ═════════════════════════════════════════════════════════════════════════════
//  MISIL TELEDIRIGIDO
// ═════════════════════════════════════════════════════════════════════════════
function lanzarMisil() {
    if (!nave || !gameRunning || gameOver) return;
    if (misiles <= 0 || cdMisil > 0) return;
    cdMisil = 60; misiles--;
    updateMissileHUD();

    let target = null, minD = Infinity;
    const pool = bossActivo && bossRef ? [bossRef, ...enemigos] : enemigos;
    pool.forEach(e => { const d = nave.position.distanceTo(e.position); if (d < minD) { minD = d; target = e; } });

    const m = new THREE.Mesh(misilGeo, misilMat);
    m.position.copy(nave.position);
    m.userData.target = target;
    m.userData.vel    = new THREE.Vector3(0, 0, -1).applyQuaternion(nave.quaternion).multiplyScalar(3);
    scene.add(m);
    misilesList.push(m);
}

function updateMissileHUD() {
    for (let i = 0; i < 3; i++) {
        const s = document.getElementById(`ms${i}`);
        if (s) s.classList.toggle('active', i < misiles);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ENEMIES
// ═════════════════════════════════════════════════════════════════════════════
function spawnEnemigo(tipo = null) {
    if (!tipo) {
        const r = Math.random();
        const d = DIFF[CONFIG.difficulty];
        if (wave >= 3 && r < 0.18 * d.spawnRate) tipo = 'kamikaze';
        else if (wave >= 2 && r < 0.32 * d.spawnRate) tipo = 'sniper';
        else tipo = 'normal';
    }

    gltfLoader.load('./models/caza_imperial.glb', g => {
        const e   = g.scene;
        const box = new THREE.Box3().setFromObject(e);
        const sz  = box.getSize(new THREE.Vector3());
        e.scale.setScalar(3 / Math.max(sz.x, sz.y, sz.z));

        // Color emissivo por tipo
        if (tipo === 'kamikaze') {
            e.traverse(c => { if (c.isMesh && c.material) { c.material = c.material.clone(); c.material.emissive = new THREE.Color(0.5,0,0); } });
        }
        if (tipo === 'sniper') {
            e.traverse(c => { if (c.isMesh && c.material) { c.material = c.material.clone(); c.material.emissive = new THREE.Color(0,0.15,0.5); } });
        }

        const ang = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 130;
        e.position.set(
            (nave?.position.x ?? 0) + Math.cos(ang) * dist,
            Math.random() * 25 + 2,
            (nave?.position.z ?? 0) + Math.sin(ang) * dist
        );

        e.userData.tipo        = tipo;
        e.userData.cdShoot     = 30 + Math.random() * 60;
        e.userData.evasionVel  = new THREE.Vector3();
        e.userData.evasionCd   = 0;

        scene.add(e);
        enemigos.push(e);
    });
}

// ═════════════════════════════════════════════════════════════════════════════
//  BOSS
// ═════════════════════════════════════════════════════════════════════════════
function spawnBoss() {
    bossActivo  = true;
    bossFase    = 1;
    bossMaxVida = 300 + wave * 50;
    bossVida    = bossMaxVida;

    enemigos.forEach(e => scene.remove(e));
    enemigos = [];

    bannerMsg('⚠ BOSS — OLEADA ' + wave, true);
    mostrarBossHUD(true);

    gltfLoader.load('./models/caza_imperial.glb', g => {
        const boss = g.scene;
        const box  = new THREE.Box3().setFromObject(boss);
        const sz   = box.getSize(new THREE.Vector3());
        boss.scale.setScalar(9 / Math.max(sz.x, sz.y, sz.z));

        boss.traverse(c => {
            if (c.isMesh && c.material) {
                c.material = c.material.clone();
                c.material.emissive          = new THREE.Color(0.6, 0, 0);
                c.material.emissiveIntensity = 0.6;
            }
        });

        const ang = Math.random() * Math.PI * 2;
        boss.position.set(
            (nave?.position.x ?? 0) + Math.cos(ang) * 120,
            15,
            (nave?.position.z ?? 0) + Math.sin(ang) * 120
        );
        boss.userData.orbitAngle  = ang;
        boss.userData.orbitRadius = 85;
        boss.userData.cdShoot     = 40;

        scene.add(boss);
        bossRef = boss;
    });
}

function tickBoss() {
    if (!bossRef || !nave) return;

    // Órbita
    bossRef.userData.orbitAngle += bossFase === 2 ? 0.013 : 0.007;
    const r  = bossRef.userData.orbitRadius;
    const tx = nave.position.x + Math.cos(bossRef.userData.orbitAngle) * r;
    const tz = nave.position.z + Math.sin(bossRef.userData.orbitAngle) * r;
    bossRef.position.x = THREE.MathUtils.lerp(bossRef.position.x, tx, 0.03);
    bossRef.position.y = THREE.MathUtils.lerp(bossRef.position.y, 15, 0.02);
    bossRef.position.z = THREE.MathUtils.lerp(bossRef.position.z, tz, 0.03);
    bossRef.lookAt(nave.position);

    // Disparo
    bossRef.userData.cdShoot--;
    if (bossRef.userData.cdShoot <= 0) {
        const q = bossFase === 1 ? 3 : 6;
        const s = bossFase === 1 ? 0.06 : 0.18;
        bossDisparo(q, s);
        bossRef.userData.cdShoot = bossFase === 1 ? 60 : 40;
    }

    // Colisión directa
    if (nave.position.distanceTo(bossRef.position) < 9 && cdDaño <= 0) {
        recibirDaño(22); cdDaño = 40;
    }

    // Cambio fase
    if (bossFase === 1 && bossVida <= bossMaxVida * 0.5) {
        bossFase = 2;
        bossRef.userData.orbitRadius = 55;
        const bp = document.getElementById('boss-phase');
        if (bp) bp.textContent = '🔥 FASE 2 — FURIA';
        bannerMsg('⚠ FASE 2 ACTIVADA', true);
        for (let i = 0; i < 3; i++) spawnEnemigo('kamikaze');
    }
}

function bossDisparo(n, spread) {
    if (!nave || !bossRef) return;
    const base = nave.position.clone().sub(bossRef.position).normalize();
    for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.28,6,6), new THREE.MeshBasicMaterial({color:0xff3300}));
        b.position.copy(bossRef.position);
        const ang = (i - n/2) * spread;
        const d   = base.clone().applyAxisAngle(new THREE.Vector3(0,1,0), ang);
        b.userData.vel = d.multiplyScalar(4 + bossFase * 0.5);
        scene.add(b);
        balasEnem.push(b);
    }
}

function dañarBoss(dmg) {
    bossVida -= dmg;
    const pct = Math.max(0, bossVida / bossMaxVida * 100);
    const bar = document.getElementById('boss-bar');
    if (bar) bar.style.width = pct + '%';
    if (bossVida <= 0) matarBoss();
}

function matarBoss() {
    const pos = bossRef.position.clone();
    crearExplosion(pos, true);
    limpiarObj(bossRef);
    bossRef    = null;
    bossActivo = false;

    score  += 1000 + wave * 200;
    misiles = Math.min(misiles + 2, 3);
    updateMissileHUD();
    mostrarBossHUD(false);
    bannerMsg('¡BOSS DESTRUIDO! +' + (1000 + wave * 200));
    spawnPowerup(pos);

    setTimeout(() => {
        wave++;
        maxEnemigos = 6 + wave * 2;
        for (let i = 0; i < maxEnemigos; i++) spawnEnemigo();
        bannerMsg('OLEADA ' + wave);
    }, 3000);
}

function mostrarBossHUD(visible) {
    const el = document.getElementById('boss-hud');
    if (el) el.style.display = visible ? '' : 'none';
    const ph = document.getElementById('boss-phase');
    if (ph) ph.textContent = 'FASE 1';
    const bar = document.getElementById('boss-bar');
    if (bar) bar.style.width = '100%';
}

// ═════════════════════════════════════════════════════════════════════════════
//  BALAS ENEMIGAS
// ═════════════════════════════════════════════════════════════════════════════
function disparoEnemigo(e) {
    if (!nave) return;
    const tipo = e.userData.tipo ?? 'normal';
    if (tipo === 'kamikaze') return;

    const spd  = (tipo === 'sniper' ? 7 : 4.5 + wave * 0.1) * DIFF[CONFIG.difficulty].enemySpd;
    const b    = new THREE.Mesh(balaEnemGeo, balaEnemMat);
    b.position.copy(e.position);

    let dir = nave.position.clone().sub(e.position).normalize();
    if (tipo === 'sniper') {
        const t   = e.position.distanceTo(nave.position) / spd;
        const pred = nave.position.clone().addScaledVector(new THREE.Vector3(velF, velY, 0), t * 0.5);
        dir = pred.sub(e.position).normalize();
    }
    b.userData.vel = dir.multiplyScalar(spd);
    scene.add(b);
    balasEnem.push(b);
}

// ═════════════════════════════════════════════════════════════════════════════
//  POWER-UPS
// ═════════════════════════════════════════════════════════════════════════════
const PU_TYPES = [
    { tipo:'escudo', icon:'🛡️', nombre:'ESCUDO TOTAL',   color:0x448aff },
    { tipo:'triple', icon:'🔱', nombre:'TRIPLE DISPARO', color:0x00ffcc },
    { tipo:'rapido', icon:'⚡', nombre:'FUEGO RÁPIDO',   color:0xffcc00 },
    { tipo:'misil',  icon:'🚀', nombre:'MISIL ×3',       color:0xff6d00 },
];

function spawnPowerup(pos) {
    const tipo = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];

    gltfLoader.load('./models/energy_orb.glb', g => {
        finalizarOrbe(g.scene, pos, tipo);
    }, undefined, () => {
        // Fallback geométrico si el modelo no carga
        const orb = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.8, 2),
            new THREE.MeshBasicMaterial({ color: tipo.color, wireframe: false })
        );
        finalizarOrbe(orb, pos, tipo);
    });
}

function finalizarOrbe(obj, pos, tipo) {
    const box = new THREE.Box3().setFromObject(obj);
    const sz  = box.getSize(new THREE.Vector3());
    const mx  = Math.max(sz.x, sz.y, sz.z);
    if (mx > 0) obj.scale.setScalar(2.5 / mx);

    obj.position.copy(pos);
    obj.position.y += 3;

    obj.userData.tipo        = tipo;
    obj.userData.baseY       = obj.position.y;
    obj.userData.floatOffset = Math.random() * Math.PI * 2;

    const light = new THREE.PointLight(tipo.color, 3, 14);
    obj.add(light);

    scene.add(obj);
    powerupOrbs.push(obj);
}

function activarPowerup(tipo) {
    if (tipo.tipo === 'misil') {
        misiles = 3; updateMissileHUD();
        notif(tipo.icon + ' ' + tipo.nombre); return;
    }
    powerupActivo = { tipo: tipo.tipo, timer: PU_DUR, max: PU_DUR };
    if (tipo.tipo === 'escudo') { escudo = 100; vida = Math.min(vida + 30, 100); }

    const pd = document.getElementById('powerup-display');
    if (pd) pd.style.display = '';
    const pi = document.getElementById('powerup-icon');
    if (pi) pi.textContent = tipo.icon;
    const pn = document.getElementById('powerup-name');
    if (pn) pn.textContent = tipo.nombre;

    notif(tipo.icon + ' ' + tipo.nombre);
}

// ═════════════════════════════════════════════════════════════════════════════
//  EXPLOSIÓN
// ═════════════════════════════════════════════════════════════════════════════
function crearExplosion(pos, grande = false) {
    playExplosion(grande);
    const n = grande ? 30 : 14;
    for (let i = 0; i < n; i++) {
        const geo = new THREE.SphereGeometry(0.1 + Math.random() * (grande ? 0.55 : 0.3), 5, 5);
        const mat = new THREE.MeshBasicMaterial({
            color: [0xffcc00,0xff6600,0xff2200,grande?0xffffff:0xff4400][Math.floor(Math.random()*(grande?4:3))],
            transparent: true
        });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(pos);
        const spd = 0.25 + Math.random() * (grande ? 1.5 : 0.9);
        p.userData.vel = new THREE.Vector3(
            (Math.random()-.5)*spd, (Math.random()-.5)*spd, (Math.random()-.5)*spd
        );
        scene.add(p); particulas.push(p);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ASTEROIDES
// ═════════════════════════════════════════════════════════════════════════════
function spawnAsteroide() {
    const modelo = Math.random() < 0.5 ? './models/asteroide_itokawa.glb' : './models/asteroide_low_poly.glb';

    const onLoad = g => {
        const a = g.scene ?? g;
        const half = MAP_LIMIT / 2;
        a.position.set(Math.random()*MAP_LIMIT-half, Math.random()*80-40, Math.random()*MAP_LIMIT-half);
        const sc = 2 + Math.random() * 4;
        a.scale.set(sc,sc,sc);
        a.userData.radio = sc * 1.5;
        a.userData.rot = { x:(Math.random()-.5)*.02, y:(Math.random()-.5)*.02, z:(Math.random()-.5)*.02 };
        a.userData.mov = { x:(Math.random()-.5)*.014, y:(Math.random()-.5)*.014, z:(Math.random()-.5)*.014 };
        scene.add(a); asteroides.push(a);
    };

    gltfLoader.load(modelo, onLoad, undefined, () => {
        // Fallback procedural
        const a = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1 + Math.random()*2, 1),
            new THREE.MeshStandardMaterial({ color:0x888888, roughness:1 })
        );
        onLoad({ scene: a });
    });
}

// ═════════════════════════════════════════════════════════════════════════════
//  DAÑO
// ═════════════════════════════════════════════════════════════════════════════
function recibirDaño(cantidad) {
    if (powerupActivo?.tipo === 'escudo') return;
    if (escudo > 0) {
        const ab = Math.min(escudo, cantidad);
        escudo -= ab; cantidad -= ab; cdEscudo = 120;
    }
    if (cantidad > 0) vida -= cantidad;

    // Flash rojo en pantalla
    const fl = document.getElementById('damage-flash');
    if (fl) {
        fl.classList.add('hit');
        setTimeout(() => fl.classList.remove('hit'), 120);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════
function limpiarObj(obj) {
    scene.remove(obj);
    obj.traverse(c => {
        if (!c.isMesh) return;
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material?.dispose();
    });
}

function bannerMsg(txt, esBoss = false) {
    const b = document.getElementById('wave-banner');
    if (!b) return;
    b.textContent   = txt;
    b.className     = esBoss ? 'boss-banner' : '';
    b.style.opacity = '1';
    setTimeout(() => { b.style.opacity = '0'; }, 2500);
}

function notif(txt) {
    const n = document.createElement('div');
    n.className = 'pickup-notif'; n.textContent = txt;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 1900);
}

function registrarKill() {
    kills++; combo++; comboTimer = COMBO_MS;
    score += (100 + wave * 10) * combo;
    const cn = document.getElementById('combo-num');
    if (cn) { cn.classList.remove('pop'); void cn.offsetWidth; cn.classList.add('pop'); }
}

// ═════════════════════════════════════════════════════════════════════════════
//  HUD UPDATE
// ═════════════════════════════════════════════════════════════════════════════
function updateHUD() {
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const bar = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; };

    bar('barra-vida',   Math.max(0, vida));
    bar('barra-escudo', Math.max(0, escudo));

    const hp = document.getElementById('barra-vida');
    if (hp) hp.classList.toggle('critical', vida < 25);

    set('score-val', score.toLocaleString());
    set('kills-val', 'BAJAS: ' + kills);
    set('wave-val',  'OLEADA ' + wave);
    set('vel-num',   Math.abs(Math.round(velF * 50)));

    // Combo
    const cd = document.getElementById('combo-display');
    const cn = document.getElementById('combo-num');
    if (cd && cn) {
        cd.style.display = combo >= 2 ? '' : 'none';
        cn.textContent   = '×' + combo;
    }

    // Power-up timer
    if (powerupActivo) {
        bar('powerup-timer-bar', powerupActivo.timer / powerupActivo.max * 100);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  CÁMARA
// ═════════════════════════════════════════════════════════════════════════════
function updateCamera() {
    if (!nave) return;
    const boom   = 12 + Math.abs(velF) * 5;
    const offset = new THREE.Vector3(0, 5, boom);
    offset.applyQuaternion(nave.quaternion);
    camera.position.lerp(nave.position.clone().add(offset), 0.07);
    camera.lookAt(nave.position);
}

// ═════════════════════════════════════════════════════════════════════════════
//  GAME OVER
// ═════════════════════════════════════════════════════════════════════════════
function mostrarGameOver() {
    ['hud','info','boss-hud','combo-display','powerup-display','missile-hud','crosshair','wave-banner']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    const s = document.createElement('div');
    s.id = 'gameover-screen';
    s.innerHTML = `
        <h1>GAME OVER</h1>
        <div class="stat-row">PUNTUACIÓN <span class="stat-num">${score.toLocaleString()}</span></div>
        <div class="stat-row">BAJAS <span class="stat-num">${kills}</span></div>
        <div class="stat-row">OLEADA <span class="stat-num">${wave}</span></div>
        <button id="btn-restart">REINICIAR</button>
        <div class="restart-hint">O PRESIONA R</div>
    `;
    document.body.appendChild(s);
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
    document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') location.reload(); });
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOOP PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
function loop() {
    if (!gameRunning || gameOver) return;
    requestAnimationFrame(loop);
    frame++;

    updateCamera();

    // Cooldowns
    if (cdDaño   > 0) cdDaño--;
    if (cdEscudo > 0) cdEscudo--;
    if (cdMisil  > 0) cdMisil--;
    if (cdDisparo > 0) cdDisparo--;

    // Regeneración
    if (escudo < 100 && cdEscudo <= 0) escudo = Math.min(100, escudo + 0.08);
    if (vida   < 100)                   vida   = Math.min(100, vida   + 0.007);

    // Combo decay
    if (combo > 1) { comboTimer--; if (comboTimer <= 0) combo = 1; }

    // Power-up decay
    if (powerupActivo) {
        powerupActivo.timer--;
        if (powerupActivo.timer <= 0) {
            powerupActivo = null;
            const pd = document.getElementById('powerup-display');
            if (pd) pd.style.display = 'none';
        }
    }

    // Disparo continuo
    if (keys[' ']) disparar();
    if (keys['f']) lanzarMisil();

    // ── MOVIMIENTO NAVE ──────────────────────────────────────────────────────
    if (nave) {
        if (keys['w']) velF += 0.06;
        if (keys['s']) velF -= 0.06;
        velF = Math.max(-2.5, Math.min(2.5, velF)) * 0.97;
        nave.translateZ(-velF);

        if (keys['q']) velY += 0.025;
        if (keys['e']) velY -= 0.025;
        velY *= 0.92;
        nave.position.y = Math.max(-30, Math.min(80, nave.position.y + velY));

        if (keys['a']) rotY += 0.018;
        if (keys['d']) rotY -= 0.018;
        rotY *= 0.92;
        nave.rotation.y += rotY;

        tRotX = THREE.MathUtils.lerp(tRotX, -velY * 1.2, 0.1);
        tRotZ = THREE.MathUtils.lerp(tRotZ, -rotY * 2.0, 0.1);
        nave.rotation.x = nave.userData.baseRot.x + tRotX;
        nave.rotation.z = nave.userData.baseRot.z + tRotZ;
    }

    // ── BOSS ─────────────────────────────────────────────────────────────────
    if (bossActivo) tickBoss();

    // ── ENEMIGOS ─────────────────────────────────────────────────────────────
    const eScale = (1 + kills * 0.035) * DIFF[CONFIG.difficulty].enemySpd;
    for (let i = enemigos.length - 1; i >= 0; i--) {
        const e    = enemigos[i];
        if (!nave) continue;
        const tipo = e.userData.tipo;
        const dir  = nave.position.clone().sub(e.position).normalize();
        const dist = e.position.distanceTo(nave.position);

        let spd;
        if      (tipo === 'kamikaze') spd = 1.5 * eScale;
        else if (tipo === 'sniper')   spd = dist > 65 ? 0 : 0.3 * eScale;
        else                          spd = (dist > 20 ? 0.55 : 0.25) * eScale;

        // Maniobra evasiva (no kamikaze)
        if (tipo !== 'kamikaze') {
            e.userData.evasionCd--;
            if (e.userData.evasionCd <= 0) {
                e.userData.evasionVel.set(
                    (Math.random()-.5)*.35, (Math.random()-.5)*.15, (Math.random()-.5)*.35
                );
                e.userData.evasionCd = 30 + Math.random() * 60;
            }
            e.position.add(e.userData.evasionVel);
        }

        e.position.addScaledVector(dir, spd);
        e.lookAt(nave.position);

        // Disparo
        e.userData.cdShoot--;
        if (e.userData.cdShoot <= 0) {
            disparoEnemigo(e);
            e.userData.cdShoot = tipo === 'sniper'
                ? Math.max(80, 140 - kills * 2)
                : Math.max(18, 55 - kills * 2);
        }

        // Colisión
        if (dist < 3 && cdDaño <= 0) {
            const dmg = (tipo === 'kamikaze' ? 28 : 12) * DIFF[CONFIG.difficulty].enemyDmg;
            recibirDaño(dmg); cdDaño = 30;
            if (tipo === 'kamikaze') {
                crearExplosion(e.position);
                limpiarObj(e); enemigos.splice(i, 1);
            }
        }
    }

    // ── BALAS ENEMIGAS ───────────────────────────────────────────────────────
    for (let i = balasEnem.length - 1; i >= 0; i--) {
        const b = balasEnem[i];
        b.position.add(b.userData.vel);
        if (nave && b.position.distanceTo(nave.position) < 2.2) {
            recibirDaño(6 * DIFF[CONFIG.difficulty].enemyDmg);
            limpiarObj(b); balasEnem.splice(i, 1);
        } else if (!nave || b.position.distanceTo(nave.position) > 750) {
            limpiarObj(b); balasEnem.splice(i, 1);
        }
    }

    // ── BALAS JUGADOR ────────────────────────────────────────────────────────
    for (let i = balas.length - 1; i >= 0; i--) {
        balas[i].position.add(balas[i].userData.vel);
        if (balas[i].position.distanceTo(balas[i].userData.ori) > 600) {
            limpiarObj(balas[i]); balas.splice(i, 1);
        }
    }

    // ── MISILES ──────────────────────────────────────────────────────────────
    for (let i = misilesList.length - 1; i >= 0; i--) {
        const m  = misilesList[i];
        const tg = m.userData.target;
        if (tg && tg.parent) {
            const d = tg.position.clone().sub(m.position).normalize().multiplyScalar(6);
            m.userData.vel.lerp(d, 0.09);
        }
        m.position.add(m.userData.vel);
        if (m.userData.vel.lengthSq() > 0) m.lookAt(m.position.clone().add(m.userData.vel));

        let hit = false;
        if (bossActivo && bossRef && m.position.distanceTo(bossRef.position) < 10) {
            crearExplosion(m.position); dañarBoss(65);
            limpiarObj(m); misilesList.splice(i, 1); hit = true;
        }
        if (!hit) {
            for (let j = enemigos.length - 1; j >= 0; j--) {
                if (m.position.distanceTo(enemigos[j].position) < 5) {
                    crearExplosion(enemigos[j].position);
                    scene.remove(enemigos[j]); enemigos.splice(j, 1);
                    registrarKill();
                    limpiarObj(m); misilesList.splice(i, 1); hit = true; break;
                }
            }
        }
        if (!hit && (!nave || m.position.distanceTo(nave.position) > 500)) {
            limpiarObj(m); misilesList.splice(i, 1);
        }
    }

    // ── COLISIONES BALAS JUGADOR ─────────────────────────────────────────────
    for (let i = balas.length - 1; i >= 0; i--) {
        if (!balas[i]) continue;
        let hit = false;

        // vs boss
        if (bossActivo && bossRef && balas[i].position.distanceTo(bossRef.position) < 9) {
            dañarBoss(10); limpiarObj(balas[i]); balas.splice(i, 1); hit = true;
        }

        // vs enemigos
        if (!hit) {
            for (let j = enemigos.length - 1; j >= 0; j--) {
                if (balas[i] && balas[i].position.distanceTo(enemigos[j].position) < 3.5) {
                    crearExplosion(enemigos[j].position);
                    const drop = Math.min(0.5, 0.18 + wave * 0.05);
                    if (Math.random() < drop) spawnPowerup(enemigos[j].position.clone());
                    scene.remove(enemigos[j]); enemigos.splice(j, 1);
                    limpiarObj(balas[i]); balas.splice(i, 1);
                    hit = true; registrarKill();
                    if (!bossActivo && enemigos.length < maxEnemigos) spawnEnemigo();
                    break;
                }
            }
        }

        // vs asteroides
        if (!hit) {
            for (let k = asteroides.length - 1; k >= 0; k--) {
                if (balas[i] && balas[i].position.distanceTo(asteroides[k].position) < asteroides[k].userData.radio) {
                    crearExplosion(balas[i].position);
                    limpiarObj(balas[i]); balas.splice(i, 1); break;
                }
            }
        }
    }

    // ── POWER-UP ORBES ───────────────────────────────────────────────────────
    for (let i = powerupOrbs.length - 1; i >= 0; i--) {
        const o = powerupOrbs[i];
        o.rotation.y += 0.025;
        o.position.y  = o.userData.baseY + Math.sin(frame * 0.05 + o.userData.floatOffset) * 0.45;
        if (nave && nave.position.distanceTo(o.position) < 5) {
            activarPowerup(o.userData.tipo);
            limpiarObj(o); powerupOrbs.splice(i, 1);
        }
    }

    // ── ASTEROIDES ───────────────────────────────────────────────────────────
    asteroides.forEach(a => {
        a.rotation.x += a.userData.rot.x;
        a.rotation.y += a.userData.rot.y;
        a.rotation.z += a.userData.rot.z;
        a.position.x  += a.userData.mov.x;
        a.position.y  += a.userData.mov.y;
        a.position.z  += a.userData.mov.z;

        if (nave && a.position.distanceTo(nave.position) > MAP_LIMIT) {
            const ang = Math.random() * Math.PI * 2;
            const d   = 100 + Math.random() * 200;
            a.position.set(
                nave.position.x + Math.cos(ang)*d,
                nave.position.y + (Math.random()-.5)*80,
                nave.position.z + Math.sin(ang)*d
            );
        }
        if (nave && cdDaño <= 0 && nave.position.distanceTo(a.position) < a.userData.radio + 2) {
            recibirDaño(18 * DIFF[CONFIG.difficulty].enemyDmg); cdDaño = 25;
        }
    });

    // ── PARTÍCULAS ───────────────────────────────────────────────────────────
    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.position.add(p.userData.vel);
        p.userData.vel.multiplyScalar(0.93);
        p.material.opacity -= 0.028;
        if (p.material.opacity <= 0) { limpiarObj(p); particulas.splice(i, 1); }
    }

    // ── OLEADAS ──────────────────────────────────────────────────────────────
    if (!bossActivo) {
        const newWave = Math.floor(kills / 10) + 1;
        if (newWave > wave) {
            wave        = newWave;
            maxEnemigos = 6 + wave * 2;
            if (wave % 5 === 0) spawnBoss();
            else bannerMsg('OLEADA ' + wave);
        }
        if (enemigos.length < maxEnemigos) spawnEnemigo();
    }

    // ── GAME OVER ────────────────────────────────────────────────────────────
    if (vida <= 0 && !gameOver) {
        gameOver = true; mostrarGameOver(); return;
    }

    updateHUD();
    renderer.render(scene, camera);
}

// ═════════════════════════════════════════════════════════════════════════════
//  ARRANCAR
// ═════════════════════════════════════════════════════════════════════════════
initThree();
setupMenu();
