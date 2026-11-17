// police.js — the wanted system: stars rise with crime, cruisers and foot
// officers respond, and the heat cools off when the player stays out of sight.
// Getting busted on foot or wasted costs cash and a trip to Solmar General.

import { dist, clamp } from './util.js';
import { nearestRoadPoint } from './city.js';

export function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.crimeTimer = 0;
}

export function updateWanted(G, dt) {
  G.crimeTimer += dt;
  // Heat cools: after 8 quiet seconds with no cop nearby, a star fades.
  if (G.wanted > 0 && G.crimeTimer > 8) {
    const copNear = G.cops.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 600) ||
      G.footCops.some((c) => c.alive && dist(c.x, c.y, G.player.x, G.player.y) < 500);
    if (!copNear) {
      G.wantedTimer += dt;
      if (G.wantedTimer > 6) {
        G.wantedTimer = 0;
        G.wanted--;
      }
    } else {
      G.wantedTimer = 0;
    }
  }

  updateFootCops(G, dt);

  // Busted: on foot, a cop standing on you for a moment ends the run.
  if (!G.player.car && G.wanted > 0) {
    const close = G.footCops.some((c) => c.alive && dist(c.x, c.y, G.player.x, G.player.y) < 48);
    const rammed = G.cops.some((c) => dist(c.x, c.y, G.player.x, G.player.y) < 40);
    if (close || rammed) {
      G.bustTimer += dt;
      if (G.bustTimer > 1.4) getBusted(G);
    } else {
      G.bustTimer = Math.max(0, G.bustTimer - dt * 2);
    }
  } else {
    G.bustTimer = 0;
  }

  // Wasted: health hits zero.
  if (G.player.health <= 0) getWasted(G);
}

function updateFootCops(G, dt) {
  // Foot officers appear when the player is on foot and wanted 2 or more.
  const wantFoot = !G.player.car && G.wanted >= 2 ? Math.min(3, G.wanted - 1) : 0;
  let guard = 0;
  while (G.footCops.filter((c) => c.alive).length < wantFoot && guard++ < 8) {
    const p = nearestRoadPoint(G.city, G.player.x + (G.rng() < 0.5 ? -1 : 1) * 420, G.player.y + (G.rng() < 0.5 ? -1 : 1) * 320);
    G.footCops.push({
      x: p.x, y: p.y, angle: 0, speed: 195,
      health: 3, alive: true, fallTimer: 0, punchTimer: 0,
    });
  }
  while (G.footCops.filter((c) => c.alive).length > wantFoot) {
    const i = G.footCops.findIndex((c) => c.alive);
    if (i < 0) break;
    G.footCops.splice(i, 1);
  }

  for (const cop of G.footCops) {
    if (!cop.alive) {
      cop.fallTimer -= dt;
      continue;
    }
    cop.punchTimer -= dt;
    const d = dist(cop.x, cop.y, G.player.x, G.player.y);
    const targetAngle = Math.atan2(G.player.y - cop.y, G.player.x - cop.x);
    cop.angle = targetAngle;
    if (d > 34) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    } else if (cop.punchTimer <= 0) {
      // The officer tackles: damage and a shove.
      cop.punchTimer = 0.9;
      G.player.health -= 9;
      G.player.hurtFlash = 0.4;
      G.player.x += Math.cos(cop.angle) * 26;
      G.player.y += Math.sin(cop.angle) * 26;
    }
  }
  G.footCops = G.footCops.filter((c) => c.alive || c.fallTimer > 0);
}

function loseCashPenalty(G) {
  const lost = Math.floor(G.player.cash * 0.2);
  G.player.cash -= lost;
  return lost;
}

function respawnAtHospital(G) {
  const h = G.city.places.hospital;
  G.player.health = G.player.maxHealth;
  G.player.ammo = Math.max(G.player.ammo, 12);
  if (G.player.car) {
    G.player.car.driver = 'parked';
    G.player.car = null;
  }
  G.player.x = h.x;
  G.player.y = h.y + 60;
  G.wanted = 0;
  G.cops.length = 0;
  G.footCops.length = 0;
  G.bustTimer = 0;
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
}

function getBusted(G) {
  const lost = loseCashPenalty(G);
  respawnAtHospital(G);
  G.mode = 'busted';
  G.modeTimer = 0;
  G.bustedNote = 'Busted! The Solmar PD took ' + '$' + lost.toLocaleString('en-US') + ' as a fine.';
  G.sfx.missionFailed();
  if (G.mission) G.mission.failed = true;
}

function getWasted(G) {
  const lost = loseCashPenalty(G);
  respawnAtHospital(G);
  G.mode = 'wasted';
  G.modeTimer = 0;
  G.wastedNote = 'Wasted! The medics patched you up — minus ' + '$' + lost.toLocaleString('en-US') + '.';
  G.sfx.missionFailed();
  if (G.mission) G.mission.failed = true;
}
