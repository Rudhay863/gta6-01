// pedestrians.js — the people of Solmar Bay: shoppers, beachgoers and
// commuters who stroll the sidewalks, cross at intersections, flee from
// gunfire, and occasionally flag down a taxi.

import { dist, pick, randRange, turnToward } from './util.js';
import { nearestRoadPoint, onBeach } from './city.js';

const SHIRT_COLORS = ['#e86a6a', '#6aa8e8', '#e8d06a', '#6ae88a', '#e8a06a', '#a06ae8', '#e8e8e8', '#333333'];
const SKIN_COLORS = ['#f0c8a0', '#c98d5f', '#8a5a3b', '#e8b88a'];

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: randRange(rng, 38, 68),
    shirt: pick(rng, SHIRT_COLORS),
    skin: pick(rng, SKIN_COLORS),
    alive: true,
    fallTimer: 0,
    fleeing: 0,
    fleeX: 0,
    fleeY: 0,
    changeTimer: randRange(rng, 2, 7),
    isFare: false, // a taxi fare waiting for a ride
  };
}

export function updatePedestrians(G, dt) {
  const rng = G.rng;
  // Keep the streets near the player populated.
  let alive = G.peds.filter((p) => p.alive).length;
  let guard = 0;
  while (alive < 20 && guard++ < 30) {
    const px = G.player.x + randRange(rng, -700, 700);
    const py = G.player.y + randRange(rng, -700, 700);
    if (dist(px, py, G.player.x, G.player.y) < 260) continue;
    if (dist(px, py, G.player.x, G.player.y) > 850) continue;
    // Peds walk on sidewalks: beside a road, or on the beach.
    const near = nearestRoadPoint(G.city, px, py);
    const sx = near.x + (rng() < 0.5 ? -58 : 58) * (Math.abs(near.x - px) < Math.abs(near.y - py) ? 1 : 0);
    const sy = near.y + (rng() < 0.5 ? -58 : 58) * (Math.abs(near.x - px) < Math.abs(near.y - py) ? 0 : 1);
    const spawnX = onBeach(px, py) ? px : sx;
    const spawnY = onBeach(px, py) ? py : sy;
    G.peds.push(makePed(spawnX, spawnY, rng));
    alive++;
  }

  for (const ped of G.peds) {
    if (!ped.alive) {
      ped.fallTimer -= dt;
      continue;
    }
    ped.changeTimer -= dt;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      stepPed(G, ped, 165, dt);
      continue;
    }
    // Amble along; at an intersection, sometimes turn onto the other road.
    if (ped.changeTimer <= 0) {
      ped.changeTimer = randRange(rng, 3, 8);
      const near = nearestRoadPoint(G.city, ped.x, ped.y);
      if (dist(ped.x, ped.y, near.x, near.y) < 90 && rng() < 0.5) {
        ped.angle += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      } else if (rng() < 0.3) {
        ped.angle += (rng() - 0.5) * 1.2;
      }
    }
    stepPed(G, ped, ped.speed, dt);
  }

  // Remove the long-dead and the far away.
  G.peds = G.peds.filter((p) => {
    if (!p.alive && p.fallTimer <= 0) return false;
    if (p.alive && dist(p.x, p.y, G.player.x, G.player.y) > 1100 && !p.isFare) return false;
    return true;
  });
}

function stepPed(G, ped, speed, dt) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  // Peds stay out of buildings and the sea; they turn around at a wall.
  let blocked = false;
  for (const b of G.city.buildings) {
    if (nx > b.x - 10 && nx < b.x + b.w + 10 && ny > b.y - 10 && ny < b.y + b.h + 10) {
      blocked = true;
      break;
    }
  }
  if (blocked || ny > 3360 || nx < 40 || nx > 3560 || ny < 40) {
    ped.angle += Math.PI / 2;
    return;
  }
  ped.x = nx;
  ped.y = ny;
}
