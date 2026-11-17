// main.js — Solmar Bay: Vice Run. Bootstraps the canvas, owns the game state
// object G, runs the frame loop, and switches between title / play / pause /
// complete / failed / busted / wasted / win. The world modules do the work;
// this file only wires them together.
//
// Screenshot staging: ?shot=start|drive|chase|mission|foot sets up a fixed
// scene (used by shots.json) so the cover shows the game at its best.

import { buildCity } from './city.js';
import { SoundFX } from './audio.js';
import { Input } from './input.js';
import { makePlayer, updatePlayer } from './player.js';
import { spawnParkedCars, updateTraffic, updatePoliceCars, stepDrivenCar, resolveCarCollisions, makeCar } from './vehicles.js';
import { updatePedestrians } from './pedestrians.js';
import { updateWanted } from './police.js';
import { startMission, updateMission, updateTaxi, MISSIONS } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawComplete, drawFailed, drawBusted, drawWasted, drawWin } from './hud.js';
import { saveGame, loadSave } from './save.js';
import { clamp, dist, mulberry32 } from './util.js';

const W = 1280;
const H = 720;

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const G = {
  W, H, canvas, ctx,
  time: 0,
  mode: 'title',
  modeTimer: 0,
  cam: { x: 675, y: 720 },
  input: new Input(canvas),
  sfx: new SoundFX(),
  rng: mulberry32(20261118),
  city: null,
  player: null,
  cars: [],
  cops: [],
  footCops: [],
  peds: [],
  particles: [],
  wanted: 0,
  wantedTimer: 0,
  crimeTimer: 0,
  bustTimer: 0,
  mission: null,
  missionIdx: 0,
  betweenTimer: 0,
  taxi: null,
  taxiTimer: 0,
  message: '',
  messageTimer: 0,
  dialogue: '',
  dialogueTimer: 0,
  stats: { carsStolen: 0, missionsDone: 0 },
  completeNote: '',
  failedNote: '',
  bustedNote: '',
  wastedNote: '',
  shot: null,
  autoDrive: false,
  ammoCrates: [],
};
G.saveNow = () => saveGame(G);
window.__GAME__ = G;

function freshWorld(save) {
  G.city = buildCity();
  G.player = makePlayer(G.city.spawn.x, G.city.spawn.y);
  G.cars = [];
  G.cops = [];
  G.footCops = [];
  G.peds = [];
  G.particles = [];
  G.wanted = 0;
  G.wantedTimer = 0;
  G.crimeTimer = 0;
  G.bustTimer = 0;
  G.mission = null;
  G.taxi = null;
  G.taxiTimer = 0;
  G.message = '';
  G.messageTimer = 0;
  G.dialogue = '';
  G.dialogueTimer = 0;
  G.stats = { carsStolen: 0, missionsDone: 0 };
  G.ammoCrates = [{ x: G.city.places.garage.x + 60, y: G.city.places.garage.y + 60, cooldown: 0 }];
  if (save) {
    G.player.cash = save.cash || 0;
    G.player.health = save.health || 100;
    G.player.ammo = save.ammo || 24;
    G.player.x = save.px || G.city.spawn.x;
    G.player.y = save.py || G.city.spawn.y;
    G.missionIdx = save.missionIdx || 0;
    G.stats.carsStolen = save.carsStolen || 0;
    G.stats.missionsDone = save.missionsDone || 0;
    if (Array.isArray(save.stashes)) {
      save.stashes.forEach((taken, i) => {
        if (taken && G.city.stashes[i]) G.city.stashes[i].taken = true;
      });
    }
  } else {
    G.missionIdx = 0;
  }
  spawnParkedCars(G, 26);
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
}

function startNewGame() {
  freshWorld(null);
  G.mode = 'play';
  G.modeTimer = 0;
  startMission(G, 0);
  G.sfx.ensure();
}

function continueGame() {
  const save = loadSave();
  if (!save) return startNewGame();
  freshWorld(save);
  G.mode = 'play';
  G.modeTimer = 0;
  G.message = 'Welcome back, Mara. The Bay missed you.';
  G.messageTimer = 3;
  G.sfx.ensure();
}

// ---- Screenshot staging ----------------------------------------------------
function setupShot(kind) {
  freshWorld(null);
  G.shot = kind;
  G.mode = 'play';
  if (kind === 'start') {
    G.mode = 'title';
    return;
  }
  if (kind === 'drive') {
    const car = makeCar('sport', 1575, 1125, 0, '#d94f3d');
    car.driver = 'player';
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.autoDrive = true;
    startMission(G, 1);
    G.mission.stepIdx = 0;
    G.dialogue = 'Rico is waiting at the Coral Docks with a package.';
    G.dialogueTimer = 30;
    return;
  }
  if (kind === 'chase') {
    const car = makeCar('sport', 2025, 1575, 0, '#d94f3d');
    car.driver = 'player';
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.autoDrive = true;
    G.wanted = 3;
    startMission(G, 3);
    G.mission.timeLeft = 74;
    // Three cruisers right behind the player.
    for (let i = 0; i < 3; i++) {
      const cop = makeCar('police', 2025 - 180 - i * 90, 1575 + (i % 2 ? 40 : -40), 0, '#1c2733');
      cop.driver = 'cop';
      cop.speed = 420;
      cop.siren = true;
      G.cops.push(cop);
    }
    G.dialogue = 'The whole force is on you. Ninety seconds to the hideout.';
    G.dialogueTimer = 30;
    return;
  }
  if (kind === 'mission') {
    const bank = G.city.places.bank;
    G.player.x = bank.x;
    G.player.y = bank.y + 90;
    G.player.ammo = 24;
    G.wanted = 3;
    startMission(G, 2);
    G.mission.stepIdx = 1;
    G.mission.holdTimer = 1.0;
    G.dialogue = 'The vault is open — hold on!';
    G.dialogueTimer = 30;
    // Officers closing in from down the street — near enough to see, far
    // enough that they cannot bust the player before the shot is taken.
    for (let i = 0; i < 2; i++) {
      G.footCops.push({
        x: bank.x - 560 + i * 120, y: bank.y + 320, angle: 0, speed: 195,
        health: 3, alive: true, fallTimer: 0, punchTimer: 0,
      });
    }
    return;
  }
  if (kind === 'foot') {
    G.player.x = 2500;
    G.player.y = 3220;
    G.missionIdx = 1;
    G.mission = null;
    G.betweenTimer = -30; // keep free roam for the shot
    G.dialogue = 'Solmar Bay at golden hour. The whole city is yours.';
    G.dialogueTimer = 30;
    return;
  }
}

// ---- Per-frame updates -----------------------------------------------------

function updatePlay(dt) {
  const p = G.player;
  updatePlayer(G, dt);
  if (p.car) stepDrivenCar(G, p.car, dt);
  updateTraffic(G, dt);
  updatePoliceCars(G, dt);
  resolveCarCollisions(G);
  updatePedestrians(G, dt);
  updateWanted(G, dt);
  updateMission(G, dt);
  updateTaxi(G, dt);
  updateParticles(G, dt);
  updatePickups(G, dt);

  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x, W / 2, 3600 - W / 2);
  const ty = clamp(p.y, H / 2, 3600 - H / 2);
  G.cam.x += (tx - G.cam.x) * Math.min(1, 5 * dt);
  G.cam.y += (ty - G.cam.y) * Math.min(1, 5 * dt);

  // Audio follows the action.
  const driving = !!p.car;
  G.sfx.setEngine(driving ? Math.abs(p.car.speed) / p.car.top : 0, driving);
  G.sfx.setSiren(G.wanted > 0 && G.cops.length > 0);

  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (G.dialogueTimer > 0) G.dialogueTimer -= dt;
}

function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.life -= dt;
    if (pt.vx !== undefined) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - 2 * dt);
      pt.vy *= Math.max(0, 1 - 2 * dt);
    }
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}

function updatePickups(G, dt) {
  const p = G.player;
  for (const s of G.city.stashes) {
    if (!s.taken && dist(p.x, p.y, s.x, s.y) < 44) {
      s.taken = true;
      p.cash += 100;
      G.sfx.pickup();
      G.message = 'Hidden stash: +$100.';
      G.messageTimer = 2.5;
    }
  }
  for (const crate of G.ammoCrates) {
    crate.cooldown = Math.max(0, crate.cooldown - dt);
    if (crate.cooldown === 0 && dist(p.x, p.y, crate.x, crate.y) < 44) {
      if (p.ammo < p.maxAmmo) {
        p.ammo = p.maxAmmo;
        crate.cooldown = 20;
        G.sfx.pickup();
        G.message = 'Ammo restocked at the garage crate.';
        G.messageTimer = 2.5;
      }
    }
  }
}

// ---- Mode keys --------------------------------------------------------------

function handleModeKeys() {
  const input = G.input;
  if (input.hit('KeyM')) G.sfx.toggleMute();
  if (G.mode === 'title') {
    if (input.hit('Enter')) startNewGame();
    else if (input.hit('KeyC') && loadSave()) continueGame();
  } else if (G.mode === 'play') {
    if (input.hit('Escape')) {
      G.mode = 'pause';
      G.modeTimer = 0;
    }
  } else if (G.mode === 'pause') {
    if (input.hit('Escape')) G.mode = 'play';
    else if (input.hit('KeyS')) {
      saveGame(G);
      G.message = 'Game saved.';
      G.messageTimer = 2;
      G.mode = 'play';
    } else if (input.hit('KeyR')) {
      if (G.mission) startMission(G, G.missionIdx);
      G.mode = 'play';
    } else if (input.hit('KeyQ')) {
      G.mode = 'title';
    }
  } else if (G.mode === 'complete') {
    if (input.hit('Enter')) {
      G.mode = 'play';
      startMission(G, G.missionIdx);
    }
  } else if (G.mode === 'failed') {
    if (input.hit('Enter')) {
      G.mode = 'play';
      startMission(G, G.missionIdx);
    }
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    if (input.hit('Enter')) G.mode = 'play';
  } else if (G.mode === 'win') {
    if (input.hit('Enter')) {
      G.mode = 'play';
      G.mission = null;
    }
  }
}

// ---- Frame loop -------------------------------------------------------------

let last = performance.now();
let shotReadySent = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  G.modeTimer += dt;

  // Staged screenshots hold the throttle down so the car drives itself.
  if (G.autoDrive) G.input.keys.add('KeyW');

  handleModeKeys();
  if (G.mode === 'play') updatePlay(dt);

  // Draw.
  ctx.clearRect(0, 0, W, H);
  if (G.mode === 'title') {
    drawTitle(G);
  } else {
    drawWorld(G);
    if (G.mode === 'play') drawHUD(G);
    else if (G.mode === 'pause') { drawHUD(G); drawPause(G); }
    else if (G.mode === 'complete') { drawHUD(G); drawComplete(G); }
    else if (G.mode === 'failed') { drawHUD(G); drawFailed(G); }
    else if (G.mode === 'busted') { drawHUD(G); drawBusted(G); }
    else if (G.mode === 'wasted') { drawHUD(G); drawWasted(G); }
    else if (G.mode === 'win') drawWin(G);
  }

  G.input.endFrame();
  if (G.shot && !shotReadySent) {
    shotReadySent = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// ---- Boot -------------------------------------------------------------------

freshWorld(null);
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) setupShot(shot);
requestAnimationFrame(frame);
