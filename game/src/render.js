// render.js — draws Solmar Bay top-down: ground, roads, beach and sea, the
// park, buildings with sun shadows, cars, people, cops, markers, particles,
// and the minimap. The camera follows the player; the HUD is drawn by hud.js.

import { clamp, dist } from './util.js';
import { WORLD, ROAD_WIDTH, BEACH_TOP, WATER_TOP } from './city.js';
import { stepTarget } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export function drawWorld(G) {
  const ctx = G.ctx;
  const cam = G.cam;
  const x0 = cam.x - VIEW_W / 2;
  const y0 = cam.y - VIEW_H / 2;
  const x1 = cam.x + VIEW_W / 2;
  const y1 = cam.y + VIEW_H / 2;

  // Ground: warm grass across the city.
  ctx.fillStyle = '#8fae6b';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawBeachAndSea(G, x0, y0, x1, y1);
  drawRoads(G, x0, y0, x1, y1);
  drawPark(G, x0, y0, x1, y1);
  drawBuildings(G, x0, y0, x1, y1);
  drawTrees(G, x0, y0, x1, y1);
  drawStashes(G, x0, y0, x1, y1);
  drawMarkers(G);
  drawCars(G, x0, y0, x1, y1);
  drawPeds(G, x0, y0, x1, y1);
  drawFootCops(G);
  drawPlayer(G);
  drawParticles(G);
}

function toScreen(G, wx, wy) {
  return { x: wx - (G.cam.x - VIEW_W / 2), y: wy - (G.cam.y - VIEW_H / 2) };
}

function drawBeachAndSea(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  if (y1 < BEACH_TOP) return;
  const s0 = toScreen(G, 0, BEACH_TOP);
  ctx.fillStyle = '#e8d49a'; // sand
  ctx.fillRect(0, Math.max(0, s0.y), VIEW_W, VIEW_H - Math.max(0, s0.y));
  // Sea with gentle animated wave lines.
  if (y1 >= WATER_TOP) {
    const sw = toScreen(G, 0, WATER_TOP);
    ctx.fillStyle = '#2f9db8';
    ctx.fillRect(0, Math.max(0, sw.y), VIEW_W, VIEW_H - Math.max(0, sw.y));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wy = sw.y + 14 + i * 22 + Math.sin(G.time * 1.2 + i * 2) * 3;
      if (wy < 0 || wy > VIEW_H) continue;
      ctx.beginPath();
      for (let x = 0; x <= VIEW_W; x += 32) {
        const yy = wy + Math.sin(x / 90 + G.time + i) * 4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

function drawRoads(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  ctx.fillStyle = '#3a3f46'; // asphalt
  for (const line of G.city.roads) {
    if (line > x0 - ROAD_WIDTH && line < x1 + ROAD_WIDTH) {
      const s = toScreen(G, line, 0);
      ctx.fillRect(s.x - ROAD_WIDTH / 2, 0, ROAD_WIDTH, VIEW_H);
    }
    if (line > y0 - ROAD_WIDTH && line < y1 + ROAD_WIDTH) {
      const s = toScreen(G, 0, line);
      ctx.fillRect(0, s.y - ROAD_WIDTH / 2, VIEW_W, ROAD_WIDTH);
    }
  }
  // Sidewalk edges.
  ctx.fillStyle = '#b8b0a0';
  for (const line of G.city.roads) {
    if (line > x0 - ROAD_WIDTH && line < x1 + ROAD_WIDTH) {
      const s = toScreen(G, line, 0);
      ctx.fillRect(s.x - ROAD_WIDTH / 2 - 8, 0, 6, VIEW_H);
      ctx.fillRect(s.x + ROAD_WIDTH / 2 + 2, 0, 6, VIEW_H);
    }
    if (line > y0 - ROAD_WIDTH && line < y1 + ROAD_WIDTH) {
      const s = toScreen(G, 0, line);
      ctx.fillRect(0, s.y - ROAD_WIDTH / 2 - 8, VIEW_W, 6);
      ctx.fillRect(0, s.y + ROAD_WIDTH / 2 + 2, VIEW_W, 6);
    }
  }
  // Centre dashes.
  ctx.strokeStyle = '#e8d44d';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const line of G.city.roads) {
    if (line > x0 - ROAD_WIDTH && line < x1 + ROAD_WIDTH) {
      const s = toScreen(G, line, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, VIEW_H);
      ctx.stroke();
    }
    if (line > y0 - ROAD_WIDTH && line < y1 + ROAD_WIDTH) {
      const s = toScreen(G, 0, line);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(VIEW_W, s.y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of G.city.roads) {
    for (const ry of G.city.roads) {
      if (rx < x0 - 80 || rx > x1 + 80 || ry < y0 - 80 || ry > y1 + 80) continue;
      const s = toScreen(G, rx, ry);
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(s.x - 4 + i * 12, s.y - ROAD_WIDTH / 2 - 4, 6, 8);
        ctx.fillRect(s.x - 4 + i * 12, s.y + ROAD_WIDTH / 2 - 4, 6, 8);
      }
    }
  }
}

function drawPark(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  const px0 = 1221, py0 = 1221, px1 = 1929, py1 = 1929;
  if (px1 < x0 || px0 > x1 || py1 < y0 || py0 > y1) return;
  const s = toScreen(G, px0, py0);
  ctx.fillStyle = '#6da35a';
  ctx.fillRect(s.x, s.y, px1 - px0, py1 - py0);
  // Diagonal footpath.
  ctx.strokeStyle = '#d8c9a0';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + (px1 - px0), s.y + (py1 - py0));
  ctx.stroke();
  // Pond.
  ctx.fillStyle = '#4fa8c9';
  ctx.beginPath();
  ctx.ellipse(s.x + 420, s.y + 180, 90, 55, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuildings(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  for (const b of G.city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const s = toScreen(G, b.x, b.y);
    // Sun shadow, cast to the south-east.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(s.x + 10, s.y + 12, b.w, b.h);
    // Body.
    ctx.fillStyle = b.color;
    ctx.fillRect(s.x, s.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(s.x + 6, s.y + 6, b.w - 12, b.h - 12);
    // Windows on tall downtown blocks.
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,220,0.75)';
      for (let wx = s.x + 14; wx < s.x + b.w - 14; wx += 22) {
        for (let wy = s.y + 14; wy < s.y + b.h - 14; wy += 22) {
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, b.w, b.h);
  }
}

function drawTrees(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  for (const t of G.city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    const s = toScreen(G, t.x, t.y);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(s.x + 4, s.y + 5, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da34f';
    ctx.beginPath();
    ctx.arc(s.x - 3, s.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStashes(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  for (const s of G.city.stashes) {
    if (s.taken) continue;
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    const p = toScreen(G, s.x, s.y);
    const pulse = 1 + Math.sin(G.time * 4) * 0.15;
    ctx.fillStyle = 'rgba(80,200,90,0.35)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2fae4e';
    ctx.fillRect(p.x - 12, p.y - 8, 24, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', p.x, p.y + 1);
  }
  // Ammo crates at the garage: green, restock the pistol.
  for (const crate of G.ammoCrates) {
    if (crate.x < x0 || crate.x > x1 || crate.y < y0 || crate.y > y1) continue;
    const p = toScreen(G, crate.x, crate.y);
    ctx.fillStyle = '#1e6b34';
    ctx.fillRect(p.x - 14, p.y - 10, 28, 20);
    ctx.strokeStyle = '#7dff5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 14, p.y - 10, 28, 20);
    ctx.fillStyle = '#7dff5e';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMMO', p.x, p.y + 1);
  }
}

function drawMarkers(G) {
  const ctx = G.ctx;
  const step = G.mission ? (G.mission.def.steps[G.mission.stepIdx] || null) : null;
  const target = step ? stepTarget(G, step) : null;
  const targets = [];
  if (target) targets.push({ x: target.x, y: target.y, color: '#ffd94d', label: target.name });
  if (G.taxi) {
    if (G.taxi.state === 'waiting') targets.push({ x: G.taxi.ped.x, y: G.taxi.ped.y, color: '#7dff5e', label: 'Fare' });
    else targets.push({ x: G.taxi.dest.x, y: G.taxi.dest.y, color: '#7dff5e', label: 'Drop-off' });
  }
  for (const t of targets) {
    const p = toScreen(G, t.x, t.y);
    const pulse = 1 + Math.sin(G.time * 5) * 0.18;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 58);
    ctx.lineTo(p.x - 10, p.y - 40);
    ctx.lineTo(p.x + 10, p.y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(t.label, p.x, p.y - 66);
    ctx.fillText(t.label, p.x, p.y - 66);
  }
  // Off-screen mission arrow at the screen edge.
  if (target) {
    const p = toScreen(G, target.x, target.y);
    if (p.x < 40 || p.x > VIEW_W - 40 || p.y < 40 || p.y > VIEW_H - 40) {
      const cx = clamp(p.x, 60, VIEW_W - 60);
      const cy = clamp(p.y, 60, VIEW_H - 60);
      const a = Math.atan2(p.y - VIEW_H / 2, p.x - VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(Math.round(dist(G.player.x, G.player.y, target.x, target.y) / 10) * 10 + 'm', cx, cy + 26);
    }
  }
}

function drawCarShape(ctx, car, screen, time) {
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(car.angle);
  const len = car.len;
  const wid = car.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 9);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = car.kind === 'police' ? '#dfe9f2' : '#20262e';
  roundRect(ctx, -len * 0.18, -wid / 2 + 5, len * 0.36, wid - 10, 6);
  ctx.fill();
  // Police livery.
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-len * 0.32, -wid / 2, len * 0.14, wid);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(-len * 0.05, -wid / 2, len * 0.1, 4);
    ctx.fillStyle = '#3d7ad9';
    ctx.fillRect(-len * 0.05, wid / 2 - 4, len * 0.1, 4);
    if (car.siren) {
      // Flashing roof light bar: red on one side, blue on the other.
      const phase = Math.floor(time * 2.4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e7dff';
      ctx.fillRect(-len * 0.32, -wid / 2 - 2, len * 0.16, 5);
      ctx.fillStyle = phase ? '#2e7dff' : '#ff2e2e';
      ctx.fillRect(-len * 0.32, wid / 2 - 3, len * 0.16, 5);
    }
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#1c1c1c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -wid / 2 - 5);
  }
  // Headlights when driving at speed.
  if (Math.abs(car.speed) > 60) {
    ctx.fillStyle = 'rgba(255,240,170,0.85)';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 4, 4, 6);
    ctx.fillRect(len / 2 - 2, wid / 2 - 10, 4, 6);
  }
  // Brake lights.
  if (car.brake) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-len / 2 - 1, -wid / 2 + 4, 4, 6);
    ctx.fillRect(-len / 2 - 1, wid / 2 - 10, 4, 6);
  }
  // The player's car gets a gold ring so it always stands out in traffic.
  if (car.driver === 'player') {
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 3;
    roundRect(ctx, -len / 2 - 5, -wid / 2 - 5, len + 10, wid + 10, 11);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(G, x0, y0, x1, y1) {
  for (const car of G.cars) {
    if (car.x < x0 - 80 || car.x > x1 + 80 || car.y < y0 - 80 || car.y > y1 + 80) continue;
    drawCarShape(G.ctx, car, toScreen(G, car.x, car.y), G.time);
  }
  for (const cop of G.cops) {
    if (cop.x < x0 - 80 || cop.x > x1 + 80 || cop.y < y0 - 80 || cop.y > y1 + 80) continue;
    drawCarShape(G.ctx, cop, toScreen(G, cop.x, cop.y), G.time);
  }
}

function drawPeds(G, x0, y0, x1, y1) {
  const ctx = G.ctx;
  for (const ped of G.peds) {
    if (ped.x < x0 - 40 || ped.x > x1 + 40 || ped.y < y0 - 40 || ped.y > y1 + 40) continue;
    const p = toScreen(G, ped.x, ped.y);
    if (!ped.alive) {
      // Fallen: lying flat.
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 14, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin(G.time * 9 + ped.x) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ped.angle) * 4, p.y + Math.sin(ped.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.isFare) {
      ctx.fillStyle = '#7dff5e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y - 22);
    }
  }
}

function drawFootCops(G) {
  const ctx = G.ctx;
  for (const cop of G.footCops) {
    const p = toScreen(G, cop.x, cop.y);
    if (p.x < -40 || p.x > VIEW_W + 40 || p.y < -40 || p.y > VIEW_H + 40) continue;
    if (!cop.alive) {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 14, 7, cop.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d7ad9';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(cop.angle) * 4, p.y + Math.sin(cop.angle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // Cap.
    ctx.fillStyle = '#101820';
    ctx.fillRect(p.x - 6, p.y - 8, 12, 4);
  }
}

function drawPlayer(G) {
  const ctx = G.ctx;
  const p = G.player;
  const s = toScreen(G, p.x, p.y);
  if (p.car) return; // the car shape already shows the driver
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s.x + 2, s.y + 5, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.speed > 0 ? Math.sin(p.walkCycle) * 1.5 : 0;
  // Mara: teal jacket, dark hair, gold hoop — the getaway driver.
  ctx.fillStyle = '#0f8a7a';
  ctx.beginPath();
  ctx.arc(s.x, s.y + bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(s.x + Math.cos(p.aimAngle) * 4, s.y + Math.sin(p.aimAngle) * 4 + bob * 0.3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.arc(s.x + Math.cos(p.aimAngle) * 4 - Math.cos(p.aimAngle) * 2, s.y + Math.sin(p.aimAngle) * 4 - Math.sin(p.aimAngle) * 2 + bob * 0.3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand, pointing at the aim.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s.x + Math.cos(p.aimAngle) * 8, s.y + Math.sin(p.aimAngle) * 8);
  ctx.lineTo(s.x + Math.cos(p.aimAngle) * 18, s.y + Math.sin(p.aimAngle) * 18);
  ctx.stroke();
  // Crosshair at the mouse.
  if (G.mode === 'play') {
    const mx = G.input.mouseX;
    const my = G.input.mouseY;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 12, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 12, my);
    ctx.moveTo(mx, my - 12);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 12);
    ctx.stroke();
  }
}

function drawParticles(G) {
  const ctx = G.ctx;
  for (const pt of G.particles) {
    const s = toScreen(G, pt.x, pt.y);
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    if (pt.kind === 'tracer') {
      ctx.strokeStyle = 'rgba(255,230,120,' + a + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const e = toScreen(G, pt.ex, pt.ey);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = 'rgba(255,220,120,' + a + ')';
      ctx.fillRect(s.x - pt.size / 2, s.y - pt.size / 2, pt.size, pt.size);
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = 'rgba(160,20,20,' + a + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, pt.size * a + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- Minimap ---------------------------------------------------------------

export function drawMinimap(G) {
  const ctx = G.ctx;
  const size = 190;
  const mx = VIEW_W - size - 14;
  const my = VIEW_H - size - 14;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,24,0.82)';
  ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, size + 8, size + 8);
  // Sea and sand.
  ctx.fillStyle = '#2f9db8';
  ctx.fillRect(mx, my + BEACH_TOP * scale, size, size - BEACH_TOP * scale);
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(mx, my + 3150 * scale, size, (WATER_TOP - 3150) * scale);
  // Roads.
  ctx.fillStyle = '#5a6068';
  for (const line of G.city.roads) {
    ctx.fillRect(mx + (line - ROAD_WIDTH / 2) * scale, my, ROAD_WIDTH * scale, size);
    ctx.fillRect(mx, my + (line - ROAD_WIDTH / 2) * scale, size, ROAD_WIDTH * scale);
  }
  // Park.
  ctx.fillStyle = '#6da35a';
  ctx.fillRect(mx + 1221 * scale, my + 1221 * scale, 708 * scale, 708 * scale);
  // Mission marker.
  const step = G.mission ? (G.mission.def.steps[G.mission.stepIdx] || null) : null;
  const target = step ? stepTarget(G, step) : null;
  if (target) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(mx + target.x * scale, my + target.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (G.taxi) {
    ctx.fillStyle = '#7dff5e';
    ctx.beginPath();
    ctx.arc(mx + G.taxi.dest.x * scale, my + G.taxi.dest.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops (blue), traffic (white), player (arrow).
  ctx.fillStyle = '#4d9fff';
  for (const cop of G.cops) {
    ctx.fillRect(mx + cop.x * scale - 2, my + cop.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    ctx.fillRect(mx + car.x * scale - 1, my + car.y * scale - 1, 2, 2);
  }
  const px = mx + G.player.x * scale;
  const py = my + G.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ff5e4d';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
