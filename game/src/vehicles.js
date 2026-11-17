// vehicles.js — cars: the player's driving physics, parked cars to steal,
// traffic that follows the road grid, and police cruisers that chase.
// All cars are plain data; this module steps them and resolves collisions.

import { clamp, dist, turnToward, angleDiff, pick, randRange } from './util.js';
import { hitsSolid, nearestRoadPoint, onBeach } from './city.js';

const KINDS = {
  sedan: { len: 66, wid: 30, top: 520, accel: 300, color: null },
  sport: { len: 68, wid: 30, top: 640, accel: 380, color: '#d94f3d' },
  taxi: { len: 66, wid: 30, top: 520, accel: 300, color: '#e8c53d' },
  van: { len: 78, wid: 34, top: 440, accel: 240, color: null },
  police: { len: 68, wid: 32, top: 580, accel: 360, color: '#1c2733' },
};

let nextCarId = 1;

export function makeCar(kind, x, y, angle, color) {
  const spec = KINDS[kind] || KINDS.sedan;
  return {
    id: nextCarId++,
    kind,
    x, y, angle,
    speed: 0,
    len: spec.len,
    wid: spec.wid,
    top: spec.top,
    accel: spec.accel,
    color: color || spec.color || '#c9c9c9',
    driver: 'parked', // parked | traffic | player | cop
    cruise: 120, // traffic target speed
    turnCooldown: 0,
    brake: false,
    siren: false,
    crashed: 0, // seconds of spin-out after a hard hit
  };
}

export function spawnParkedCars(G, count) {
  const rng = G.rng;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 400) {
    const road = pick(rng, G.city.roads);
    const along = randRange(rng, 300, 3300);
    const horizontal = rng() < 0.5;
    const lane = pick(rng, [-26, 26]);
    const x = horizontal ? along : road + lane;
    const y = horizontal ? road + lane : along;
    const angle = horizontal ? (lane < 0 ? 0 : Math.PI) : (lane < 0 ? Math.PI / 2 : -Math.PI / 2);
    if (dist(x, y, G.player.x, G.player.y) < 200) continue;
    if (hitsSolid(G.city, x, y, 34)) continue;
    const kind = pick(rng, ['sedan', 'sedan', 'sport', 'van']);
    const car = makeCar(kind, x, y, angle, pick(rng, G.city.carColors));
    car.driver = 'parked';
    G.cars.push(car);
    placed++;
  }
}

// Step one car that the player drives. Returns nothing; mutates the car.
export function stepDrivenCar(G, car, dt) {
  const input = G.input;
  const axes = input.moveAxes();
  const handbrake = input.down('Space');
  const onSand = onBeach(car.x, car.y);
  const top = car.top * (onSand ? 0.55 : 1);

  if (car.crashed > 0) {
    car.crashed -= dt;
    car.speed *= Math.max(0, 1 - 3 * dt);
  } else if (axes.y < 0) {
    car.speed += car.accel * dt; // W / Up: accelerate
  } else if (axes.y > 0) {
    car.speed -= (car.speed > 5 ? 520 : 260) * dt; // S / Down: brake or reverse
  } else {
    car.speed -= car.speed * 0.9 * dt; // coast
  }
  if (handbrake) car.speed -= car.speed * 3.2 * dt;
  car.speed = clamp(car.speed, -190, top);

  const steerAuthority = clamp(Math.abs(car.speed) / 140, 0, 1);
  const steerRate = (handbrake ? 3.4 : 2.3) * steerAuthority * Math.sign(car.speed || 1);
  car.angle += axes.x * steerRate * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsSolid(G.city, nx, ny, 24)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Bump: lose speed, thud, and if it was hard, spin out briefly.
    if (Math.abs(car.speed) > 260) {
      car.crashed = 0.5;
      G.sfx.crash();
      spawnCrashSparks(G, car.x, car.y);
    }
    car.speed *= 0.35;
  }
  car.brake = axes.y > 0 || handbrake;
}

function spawnCrashSparks(G, x, y) {
  for (let i = 0; i < 10; i++) {
    G.particles.push({
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
      life: 0.4, maxLife: 0.4, size: 3,
    });
  }
}

// Traffic: keep the roads near the player busy, despawn far cars.
export function updateTraffic(G, dt) {
  const rng = G.rng;
  // Spawn up to the target count near the player.
  const target = 14;
  let traffic = G.cars.filter((c) => c.driver === 'traffic');
  let guard = 0;
  while (traffic.length < target && guard++ < 40) {
    const road = pick(rng, G.city.roads);
    const along = G.player.x + randRange(rng, -900, 900);
    const horizontal = rng() < 0.5;
    const lane = pick(rng, [-24, 24]);
    const x = horizontal ? clamp(along, 260, 3340) : road + lane;
    const y = horizontal ? road + lane : clamp(along, 260, 3340);
    if (dist(x, y, G.player.x, G.player.y) < 320) continue;
    if (dist(x, y, G.player.x, G.player.y) > 1100) continue;
    if (hitsSolid(G.city, x, y, 34)) continue;
    const kind = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sport']);
    const car = makeCar(kind, x, y, horizontal ? (lane < 0 ? 0 : Math.PI) : (lane < 0 ? Math.PI / 2 : -Math.PI / 2), pick(rng, G.city.carColors));
    car.driver = 'traffic';
    car.cruise = randRange(rng, 100, 160);
    car.speed = car.cruise;
    G.cars.push(car);
    traffic.push(car);
  }

  for (const car of traffic) {
    stepTrafficCar(G, car, dt);
  }

  // Despawn traffic (never the player's car, never parked cars near the player).
  G.cars = G.cars.filter((c) => {
    if (c.driver === 'traffic' && dist(c.x, c.y, G.player.x, G.player.y) > 1300) return false;
    if (c.driver === 'parked' && dist(c.x, c.y, G.player.x, G.player.y) > 1500) return false;
    return true;
  });
}

function stepTrafficCar(G, car, dt) {
  car.turnCooldown -= dt;
  // Slow down for a car directly ahead.
  let aheadClear = true;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 90 && side < 34) { aheadClear = false; break; }
  }
  const want = aheadClear ? car.cruise : 0;
  car.speed += clamp(want - car.speed, -260 * dt, 200 * dt);

  // At an intersection, sometimes turn left or right.
  const inter = nearestIntersectionPoint(G, car);
  if (inter && car.turnCooldown <= 0) {
    const r = G.rng();
    if (r < 0.22) car.angle += Math.PI / 2;
    else if (r < 0.44) car.angle -= Math.PI / 2;
    car.turnCooldown = 1.2;
    // Snap onto the road line after turning.
    const snapped = nearestRoadPoint(G.city, car.x, car.y);
    car.x = snapped.x;
    car.y = snapped.y;
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsSolid(G.city, nx, ny, 24)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed = 0;
    car.angle += Math.PI / 2;
    car.turnCooldown = 1.5;
  }
}

function nearestIntersectionPoint(G, car) {
  for (const rx of G.city.roads) {
    for (const ry of G.city.roads) {
      if (dist(car.x, car.y, rx, ry) < 26) return { x: rx, y: ry };
    }
  }
  return null;
}

// Police cruisers: chase the player, ram, and give up if they fall too far behind.
export function updatePoliceCars(G, dt) {
  const want = Math.min(G.wanted, 4);
  // Spawn cruisers up to the wanted level, at road points behind the player.
  let guard = 0;
  while (G.cops.length < want && guard++ < 10) {
    const p = nearestRoadPoint(G.city, G.player.x + (G.rng() < 0.5 ? -1 : 1) * 700, G.player.y + (G.rng() < 0.5 ? -1 : 1) * 500);
    const car = makeCar('police', p.x, p.y, 0, '#1c2733');
    car.driver = 'cop';
    car.speed = 200;
    car.siren = true;
    G.cops.push(car);
  }
  // Extra cruisers leave when the wanted level drops.
  while (G.cops.length > want) G.cops.pop();

  for (const cop of G.cops) {
    stepCopCar(G, cop, dt);
  }
  // Despawn cruisers that fell far behind and are off-screen.
  G.cops = G.cops.filter((c) => dist(c.x, c.y, G.player.x, G.player.y) < 1600);
}

function stepCopCar(G, cop, dt) {
  const targetAngle = Math.atan2(G.player.y - cop.y, G.player.x - cop.x);
  const d = dist(cop.x, cop.y, G.player.x, G.player.y);
  const wantSpeed = d > 500 ? cop.top : (d > 140 ? 460 : 300);
  cop.speed += clamp(wantSpeed - cop.speed, -420 * dt, 320 * dt);
  cop.angle = turnToward(cop.angle, targetAngle, 2.6 * dt * clamp(Math.abs(cop.speed) / 120, 0.3, 1));

  const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
  if (!hitsSolid(G.city, nx, ny, 24)) {
    cop.x = nx;
    cop.y = ny;
  } else {
    cop.speed *= 0.4;
    cop.angle = turnToward(cop.angle, targetAngle, 1.2 * dt);
  }

  // Ramming the player's car: shove it and slow it.
  const pc = G.player.car;
  if (pc && dist(cop.x, cop.y, pc.x, pc.y) < 62) {
    const push = Math.atan2(pc.y - cop.y, pc.x - cop.x);
    pc.x += Math.cos(push) * 26 * dt * 10;
    pc.y += Math.sin(push) * 26 * dt * 10;
    pc.speed *= Math.max(0, 1 - 1.6 * dt);
    if (Math.abs(cop.speed) > 200 && G.sfx) G.sfx.crash();
  }
  // Ramming the player on foot hurts.
  if (!pc && dist(cop.x, cop.y, G.player.x, G.player.y) < 46) {
    G.player.health -= 26 * dt;
    G.player.x += Math.cos(Math.atan2(G.player.y - cop.y, G.player.x - cop.x)) * 60 * dt;
    G.player.y += Math.sin(Math.atan2(G.player.y - cop.y, G.player.x - cop.x)) * 60 * dt;
  }
}

// Simple circle push-apart between all cars so they never overlap.
export function resolveCarCollisions(G) {
  const all = [...G.cars, ...G.cops];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        a.speed *= 0.92;
        b.speed *= 0.92;
      }
    }
  }
}
