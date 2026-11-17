// hud.js — everything drawn on top of the world: the HUD (cash, health,
// wanted stars, objective, speed), the dialogue line, the start screen,
// pause menu, and the mission-complete / busted / wasted / win screens.

import { formatCash, formatTime, clamp } from './util.js';
import { MISSIONS, currentStep } from './missions.js';
import { drawMinimap } from './render.js';
import { hasSave } from './save.js';

const W = 1280;
const H = 720;

export function drawHUD(G) {
  const ctx = G.ctx;
  // Cash + health, top-left.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(12, 12, 220, 64);
  ctx.fillStyle = '#7dff5e';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(formatCash(G.player.cash), 24, 42);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(24, 52, 150, 10);
  ctx.fillStyle = G.player.health > 30 ? '#4dd95e' : '#e84f3d';
  ctx.fillRect(24, 52, 150 * clamp(G.player.health / G.player.maxHealth, 0, 1), 10);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('HP', 178, 61);
  // Ammo, under the cash box (on foot only).
  if (!G.player.car) {
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.fillRect(12, 82, 120, 28);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Ammo ' + G.player.ammo, 22, 101);
  }

  // Wanted stars, top-right.
  const stars = 5;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < stars; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('\u2605', W - 20 - i * 30, 44);
  }
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(G.wanted > 0 ? 'WANTED' : 'CLEAN', W - 20, 62);

  // Mission objective, top-centre.
  const step = currentStep(G);
  if (G.mission && step) {
    ctx.textAlign = 'center';
    const label = G.mission.def.name + '  \u2022  ' + step.text;
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.fillRect(W / 2 - tw / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(label, W / 2, 35);
    // Hold progress / timer under the objective.
    if (step.kind === 'hold' && G.mission.holdTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(W / 2 - 100, 50, 200, 8);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(W / 2 - 100, 50, 200 * clamp(G.mission.holdTimer / step.hold, 0, 1), 8);
    }
    if (step.kind === 'timed' && G.mission.timeLeft > 0) {
      ctx.fillStyle = G.mission.timeLeft < 15 ? '#ff5e4d' : '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(formatTime(G.mission.timeLeft), W / 2, 68);
    }
  } else if (!G.mission && G.missionIdx < MISSIONS.length) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Free roam — next job: ' + MISSIONS[G.missionIdx].name, W / 2, 32);
  }

  // Speed, bottom-left (driving only).
  if (G.player.car) {
    const kmh = Math.round(Math.abs(G.player.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.fillRect(12, H - 62, 150, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(kmh + '', 24, H - 28);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h', 82, H - 28);
    ctx.fillText('E — get out   Space — handbrake', 12, H - 72);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move   Mouse aim   Click shoot   E enter car   M mute   Esc pause', 12, H - 14);
  }

  // Toast message, bottom-centre.
  if (G.messageTimer > 0 && G.message) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(G.message).width;
    ctx.fillStyle = 'rgba(10,16,24,0.78)';
    ctx.fillRect(W / 2 - tw / 2 - 12, H - 108, tw + 24, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(G.message, W / 2, H - 88);
  }

  // Story dialogue line, above the toast.
  if (G.dialogueTimer > 0 && G.dialogue) {
    ctx.textAlign = 'center';
    ctx.font = 'italic 15px sans-serif';
    const tw = ctx.measureText(G.dialogue).width;
    ctx.fillStyle = 'rgba(20,20,40,0.78)';
    ctx.fillRect(W / 2 - tw / 2 - 12, H - 148, tw + 24, 30);
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText(G.dialogue, W / 2, H - 128);
  }

  // Bust warning while a cop is on top of you.
  if (G.bustTimer > 0.2 && !G.player.car) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5e4d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('BUSTED IN ' + (1.4 - G.bustTimer).toFixed(1) + 's — RUN!', W / 2, 120);
  }

  // Hurt vignette.
  if (G.player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(220,30,30,' + (G.player.hurtFlash * 0.4) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  drawMinimap(G);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,14,22,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function titleText(ctx, text, y, size, color, bold) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}

export function drawTitle(G) {
  const ctx = G.ctx;
  // Sunset gradient sky over a drawn skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b1d4e');
  grad.addColorStop(0.5, '#c94f6d');
  grad.addColorStop(1, '#f08c3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(W - 260, 150, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,10,30,0.85)';
  const skyline = [90, 150, 110, 190, 130, 100, 170, 140, 120, 200, 150, 90];
  let sx = 0;
  for (const hgt of skyline) {
    ctx.fillRect(sx, H - 190 - hgt, 110, 190 + hgt);
    sx += 110;
  }
  ctx.fillStyle = 'rgba(255,220,120,0.9)';
  for (let i = 0; i < 60; i++) {
    const wx = (i * 173) % W;
    const wy = H - 180 + ((i * 97) % 160);
    ctx.fillRect(wx, wy, 5, 7);
  }
  titleText(ctx, 'SOLMAR BAY', 150, 84, '#ffd94d', true);
  titleText(ctx, 'VICE RUN', 215, 40, '#ffffff', true);
  titleText(ctx, 'An open-world crime game — steal cars, outrun the law, run the city.', 265, 18, '#ffe9b0', false);
  titleText(ctx, 'Mara Voss came back to Solmar Bay with nothing but a fast foot and a faster car.', 292, 16, '#ffffff', false);
  titleText(ctx, 'Five jobs stand between her and the top of the Bay.', 316, 16, '#ffffff', false);

  panel(ctx, W / 2 - 330, 350, 660, 200);
  titleText(ctx, 'WASD / arrows — move & drive      Mouse — aim      Click — shoot', 392, 16, '#ffffff', false);
  titleText(ctx, 'E — steal / enter / exit a car      Space — handbrake      Shift — sprint', 420, 16, '#ffffff', false);
  titleText(ctx, 'M — mute      Esc — pause      Progress saves after every job', 448, 16, '#ffffff', false);
  titleText(ctx, 'Wanted stars bring the police. Lose them to go clean.', 476, 16, '#ffd9a0', false);
  titleText(ctx, 'Side work: taxi fares ($) and hidden cash stashes around the city.', 504, 16, '#ffd9a0', false);

  const blink = Math.sin(G.time * 3) > 0;
  if (blink) titleText(ctx, hasSave() ? 'Press ENTER to start  •  C to continue your save' : 'Press ENTER to start', 600, 22, '#ffffff', true);
  titleText(ctx, 'Original city, characters and story — nothing from any commercial game.', 660, 13, 'rgba(255,255,255,0.65)', false);
}

export function drawPause(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 260, 190, 520, 300);
  titleText(ctx, 'PAUSED', 250, 36, '#ffd94d', true);
  titleText(ctx, 'Esc — resume', 310, 18, '#ffffff', false);
  titleText(ctx, 'S — save game', 340, 18, '#ffffff', false);
  titleText(ctx, 'R — restart current job', 370, 18, '#ffffff', false);
  titleText(ctx, 'M — mute ' + (G.sfx.muted ? '(muted)' : '(sound on)'), 400, 18, '#ffffff', false);
  titleText(ctx, 'Q — quit to title', 430, 18, '#ffffff', false);
  titleText(ctx, 'Cash ' + formatCash(G.player.cash) + '   •   Jobs done: ' + G.stats.missionsDone + ' / ' + MISSIONS.length, 465, 15, '#ffd9a0', false);
}

export function drawComplete(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 300, 240, 600, 180);
  titleText(ctx, 'JOB DONE', 300, 40, '#7dff5e', true);
  titleText(ctx, G.completeNote || '', 345, 18, '#ffffff', false);
  if (Math.sin(G.time * 3) > 0) titleText(ctx, 'Press ENTER for the next job', 385, 18, '#ffd94d', true);
}

export function drawFailed(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 300, 240, 600, 180);
  titleText(ctx, 'JOB FAILED', 300, 40, '#ff5e4d', true);
  titleText(ctx, G.failedNote || '', 345, 18, '#ffffff', false);
  if (Math.sin(G.time * 3) > 0) titleText(ctx, 'Press ENTER to try again', 385, 18, '#ffd94d', true);
}

export function drawBusted(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(10,10,40,0.7)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 300, 240, 600, 180);
  titleText(ctx, 'BUSTED', 300, 40, '#4d9fff', true);
  titleText(ctx, G.bustedNote || '', 345, 18, '#ffffff', false);
  if (Math.sin(G.time * 3) > 0) titleText(ctx, 'Press ENTER to walk out of Solmar General', 385, 18, '#ffd94d', true);
}

export function drawWasted(G) {
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(40,10,10,0.7)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 300, 240, 600, 180);
  titleText(ctx, 'WASTED', 300, 40, '#ff5e4d', true);
  titleText(ctx, G.wastedNote || '', 345, 18, '#ffffff', false);
  if (Math.sin(G.time * 3) > 0) titleText(ctx, 'Press ENTER to walk out of Solmar General', 385, 18, '#ffd94d', true);
}

export function drawWin(G) {
  const ctx = G.ctx;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1d2b4e');
  grad.addColorStop(1, '#0f8a7a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  titleText(ctx, 'BAY LEGEND', 220, 72, '#ffd94d', true);
  titleText(ctx, 'Mara Voss runs Solmar Bay now. Every job done, every cop outrun.', 290, 20, '#ffffff', false);
  titleText(ctx, 'Final cash: ' + formatCash(G.player.cash) + '   •   Cars stolen: ' + G.stats.carsStolen, 330, 18, '#ffd9a0', false);
  titleText(ctx, 'Keep playing in free roam — taxi fares and stashes are still out there.', 370, 16, '#ffffff', false);
  if (Math.sin(G.time * 3) > 0) titleText(ctx, 'Press ENTER to keep playing', 430, 20, '#ffffff', true);
}
