// player.js — Mara Voss on foot: walk, sprint, aim with the mouse, shoot,
// and steal or enter cars. Driving itself lives in vehicles.js; this module
// owns the player body and the on-foot / in-car switch.

import { dist } from './util.js';
import { hitsSolid, inWater, onBeach } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2, // facing up the street
    speed: 0,
    health: 100,
    maxHealth: 100,
    cash: 0,
    ammo: 24,
    maxAmmo: 60,
    car: null, // the car object when driving, else null
    aimAngle: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    walkCycle: 0,
  };
}

// Nearest car the player can enter (within 80 px), or null.
export function nearestEnterableCar(G) {
  let best = null;
  let bd = 80;
  for (const car of [...G.cars, ...G.cops]) {
    if (car.driver === 'player') continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  if (p.car) {
    updateDrivingPlayer(G, dt);
    return;
  }

  // On foot: WASD moves, Shift sprints, mouse aims.
  const axes = input.moveAxes();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? 265 : 175;
  const mx = axes.x;
  const my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    const onSand = onBeach(p.x, p.y);
    const stepSpeed = onSand ? speed * 0.7 : speed;
    const nx = p.x + (mx / len) * stepSpeed * dt;
    const ny = p.y + (my / len) * stepSpeed * dt;
    if (!hitsSolid(G.city, nx, p.y, 16)) p.x = nx;
    if (!hitsSolid(G.city, p.x, ny, 16)) p.y = ny;
    p.walkCycle += dt * 10;
    p.speed = stepSpeed;
    p.angle = Math.atan2(my, mx);
  } else {
    p.speed = 0;
  }

  // Aim at the mouse (screen centre is the player; mouse is canvas pixels).
  const cx = G.W / 2;
  const cy = G.H / 2;
  p.aimAngle = Math.atan2(input.mouseY - cy, input.mouseX - cx);

  // E: enter the nearest car.
  if (input.hit('KeyE')) {
    const car = nearestEnterableCar(G);
    if (car) enterCar(G, car);
    else if (G.taxi && G.taxi.state === 'waiting' && dist(p.x, p.y, G.taxi.ped.x, G.taxi.ped.y) < 70) {
      // handled by the taxi module through G.taxi.pickupRequested
      G.taxi.pickupRequested = true;
    }
  }

  // Click: shoot the pistol.
  if (input.mouseDown && p.shootCooldown <= 0) {
    shoot(G);
  }

  // Slow health regen while the police are not looking for you.
  if (G.wanted === 0 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + 2.5 * dt);
  }
}

function updateDrivingPlayer(G, dt) {
  const p = G.player;
  const car = p.car;
  // Player position follows the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // E: get out (to the side of the car).
  if (G.input.hit('KeyE')) {
    exitCar(G);
  }
  // Ramming pedestrians while driving is a crime, handled by collision scan.
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (Math.abs(car.speed) > 120 && dist(ped.x, ped.y, car.x, car.y) < 40) {
      ped.alive = false;
      ped.fallTimer = 3;
      G.wanted = Math.min(5, G.wanted + 1);
      G.crimeTimer = 0;
      addBlood(G, ped.x, ped.y);
      G.sfx.crash();
    }
  }
}

export function enterCar(G, car) {
  const p = G.player;
  const wasParked = car.driver === 'parked';
  const wasCop = car.driver === 'cop';
  if (wasCop) {
    // Stealing a police cruiser is bold: instant 2 stars.
    G.wanted = Math.min(5, G.wanted + 2);
  } else if (wasParked) {
    // Grand theft auto: the city notices.
    if (G.wanted === 0) G.wanted = 1;
    G.stats.carsStolen++;
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  G.sfx.door();
  G.message = wasParked ? 'You stole the car. The law noticed.' : 'Behind the wheel.';
  G.messageTimer = 2.5;
  G.crimeTimer = 0;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  // Step out to the car's left side, clear of buildings.
  const sx = car.x + Math.cos(car.angle - Math.PI / 2) * 44;
  const sy = car.y + Math.sin(car.angle - Math.PI / 2) * 44;
  if (!hitsSolid(G.city, sx, sy, 16) && !inWater(sx, sy)) {
    p.x = sx;
    p.y = sy;
  } else {
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
  }
  p.car = null;
  G.sfx.door();
}

function shoot(G) {
  const p = G.player;
  if (p.ammo <= 0) {
    G.sfx.denied();
    p.shootCooldown = 0.35;
    G.message = 'Out of ammo — find the green crates at the garage.';
    G.messageTimer = 2;
    return;
  }
  p.ammo--;
  p.shootCooldown = 0.22;
  G.sfx.gunshot();
  if (G.wanted === 0) G.wanted = 1;
  G.crimeTimer = 0;
  const range = 460;
  const ax = Math.cos(p.aimAngle);
  const ay = Math.sin(p.aimAngle);
  // Tracer + muzzle flash.
  G.particles.push({
    kind: 'tracer', x: p.x, y: p.y,
    ex: p.x + ax * range, ey: p.y + ay * range,
    life: 0.08, maxLife: 0.08, size: 2,
  });
  // Hit scan: pedestrians, foot cops, then traffic cars (sparks only).
  let bestD = range;
  let hitPed = null;
  let hitCop = null;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const d = rayHit(p.x, p.y, ax, ay, ped.x, ped.y, 18);
    if (d !== null && d < bestD) { bestD = d; hitPed = ped; hitCop = null; }
  }
  for (const cop of G.footCops) {
    if (!cop.alive) continue;
    const d = rayHit(p.x, p.y, ax, ay, cop.x, cop.y, 18);
    if (d !== null && d < bestD) { bestD = d; hitCop = cop; hitPed = null; }
  }
  if (hitPed) {
    hitPed.alive = false;
    hitPed.fallTimer = 4;
    addBlood(G, hitPed.x, hitPed.y);
    G.wanted = Math.min(5, G.wanted + 1);
    G.crimeTimer = 0;
    scareNearbyPeds(G, hitPed.x, hitPed.y);
  } else if (hitCop) {
    hitCop.health -= 1;
    addBlood(G, hitCop.x, hitCop.y);
    if (hitCop.health <= 0) {
      hitCop.alive = false;
      hitCop.fallTimer = 4;
      G.wanted = Math.min(5, G.wanted + 1);
    }
    G.crimeTimer = 0;
  } else {
    // Bullet impact sparks at the first building or the range end.
    const ix = p.x + ax * bestD;
    const iy = p.y + ay * bestD;
    for (let i = 0; i < 6; i++) {
      G.particles.push({
        kind: 'spark', x: ix, y: iy,
        vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180,
        life: 0.3, maxLife: 0.3, size: 2,
      });
    }
  }
  scareNearbyPeds(G, p.x, p.y);
}

// Distance along the ray to a circle, or null when the ray misses.
function rayHit(ox, oy, ax, ay, cx, cy, r) {
  const dx = cx - ox;
  const dy = cy - oy;
  const t = dx * ax + dy * ay;
  if (t < 0) return null;
  const px = ox + ax * t;
  const py = oy + ay * t;
  const d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py);
  if (d2 > r * r) return null;
  return t;
}

function addBlood(G, x, y) {
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      kind: 'blood', x, y,
      vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
      life: 0.8, maxLife: 0.8, size: 4,
    });
  }
}

function scareNearbyPeds(G, x, y) {
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (dist(ped.x, ped.y, x, y) < 320) {
      ped.fleeing = 2.5;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}
