// missions.js — Mara Voss's story: five jobs across Solmar Bay, plus the
// taxi side hustle. A mission is a list of steps; each step is one kind of
// objective (get in a car, reach a marker, hold a spot, lose the heat, beat
// a timer, or a chain of checkpoints). Completing a mission pays cash and
// saves the game.

import { dist, formatCash } from './util.js';

export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Wheels',
    intro: 'Mara needs wheels. Any car will do — Solmar Bay is full of them.',
    steps: [
      { kind: 'car', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', place: 'garage', text: 'Drive to Mara\u2019s Garage' },
    ],
    reward: 200,
  },
  {
    id: 'm2',
    name: 'The Pickup',
    intro: 'Rico is waiting at the Coral Docks with a package. Bring him home.',
    steps: [
      { kind: 'goto', place: 'dock', text: 'Drive to the Coral Docks' },
      { kind: 'carry', place: 'safehouse', text: 'Drive Rico to the Safehouse (watch for the law)' },
    ],
    reward: 400,
    wantedOnCarry: 2,
  },
  {
    id: 'm3',
    name: 'Bayfront Bank',
    intro: 'The vault is open for thirty seconds. Get in, grab the cash, get out.',
    steps: [
      { kind: 'goto', place: 'bank', text: 'Reach the Bayfront Bank (on foot is fine)' },
      { kind: 'hold', place: 'bank', hold: 6, text: 'Crack the vault — stay at the bank!' },
      { kind: 'escape', text: 'Lose the heat — get your wanted level to zero' },
    ],
    reward: 800,
    wantedOnHold: 3,
  },
  {
    id: 'm4',
    name: 'Hot Pursuit',
    intro: 'The whole force is on you. Ninety seconds to the hideout. Floor it.',
    steps: [
      { kind: 'timed', place: 'hideout', time: 90, text: 'Reach the Hideout before the timer runs out' },
    ],
    reward: 1200,
    wantedOnStart: 4,
  },
  {
    id: 'm5',
    name: 'The Big One',
    intro: 'One last delivery: three drops, then the yacht. The city will not make it easy.',
    steps: [
      { kind: 'checkpoints', places: ['casino', 'dock', 'safehouse'], text: 'Make the three drops' },
      { kind: 'goto', place: 'yacht', text: 'Reach the Yacht Marina' },
    ],
    reward: 2500,
    wantedOnStart: 5,
  },
];

export function startMission(G, idx) {
  const def = MISSIONS[idx];
  if (!def) return;
  G.missionIdx = idx;
  G.mission = {
    def,
    stepIdx: 0,
    failed: false,
    holdTimer: 0,
    timeLeft: 0,
    checkpointIdx: 0,
    passenger: false,
  };
  if (def.wantedOnStart) G.wanted = def.wantedOnStart;
  G.message = def.name + ' — ' + def.intro;
  G.messageTimer = 5;
  G.dialogue = def.intro;
  G.dialogueTimer = 5;
}

export function currentStep(G) {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.stepIdx] || null;
}

export function stepTarget(G, step) {
  if (!step) return null;
  if (step.place) return G.city.places[step.place];
  if (step.places) {
    const name = step.places[G.mission.checkpointIdx] || step.places[step.places.length - 1];
    return G.city.places[name];
  }
  return null;
}

export function updateMission(G, dt) {
  if (!G.mission) {
    // Between missions: offer the next one after a breather.
    G.betweenTimer = (G.betweenTimer || 0) + dt;
    if (G.betweenTimer > 4 && G.missionIdx < MISSIONS.length) {
      G.betweenTimer = 0;
      startMission(G, G.missionIdx);
    }
    return;
  }
  const m = G.mission;
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;

  if (step.kind === 'car') {
    if (p.car) completeStep(G, 'Wheels acquired.');
  } else if (step.kind === 'goto') {
    const t = stepTarget(G, step);
    if (t && dist(p.x, p.y, t.x, t.y) < 110) completeStep(G, 'You reached ' + t.name + '.');
  } else if (step.kind === 'carry') {
    if (!m.passenger) {
      const t = stepTarget(G, { place: 'dock' });
      // Rico hops in once you stop at the docks in a car.
      if (p.car && t && dist(p.x, p.y, t.x, t.y) < 130) {
        m.passenger = true;
        if (m.def.wantedOnCarry) G.wanted = Math.max(G.wanted, m.def.wantedOnCarry);
        G.message = 'Rico is in! The cops heard the call — drive!';
        G.messageTimer = 3.5;
        G.sfx.setSiren(true);
      }
    } else {
      const t = stepTarget(G, step);
      if (t && dist(p.x, p.y, t.x, t.y) < 110) completeStep(G, 'Rico is safe. Nice driving.');
    }
  } else if (step.kind === 'hold') {
    const t = stepTarget(G, step);
    if (t && dist(p.x, p.y, t.x, t.y) < 120) {
      if (m.holdTimer === 0 && m.def.wantedOnHold) {
        G.wanted = Math.max(G.wanted, m.def.wantedOnHold);
        G.message = 'Alarms! The vault is open — hold on!';
        G.messageTimer = 3;
      }
      m.holdTimer += dt;
      if (m.holdTimer >= step.hold) completeStep(G, 'Vault emptied. Run!');
    } else {
      m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
    }
  } else if (step.kind === 'escape') {
    if (G.wanted === 0) completeStep(G, 'Clean. The heat is off.');
  } else if (step.kind === 'timed') {
    if (m.timeLeft === 0) m.timeLeft = step.time;
    m.timeLeft -= dt;
    const t = stepTarget(G, step);
    if (t && dist(p.x, p.y, t.x, t.y) < 110) {
      completeStep(G, 'You made it with ' + Math.ceil(m.timeLeft) + ' seconds to spare!');
    } else if (m.timeLeft <= 0) {
      failMission(G, 'Too slow — the hideout door is shut.');
    }
  } else if (step.kind === 'checkpoints') {
    const t = stepTarget(G, step);
    if (t && dist(p.x, p.y, t.x, t.y) < 110) {
      m.checkpointIdx++;
      if (m.checkpointIdx >= step.places.length) {
        completeStep(G, 'All drops made. To the yacht!');
      } else {
        G.message = 'Drop ' + m.checkpointIdx + ' of ' + step.places.length + ' done.';
        G.messageTimer = 2.5;
        G.sfx.pickup();
      }
    }
  }
}

function completeStep(G, note) {
  const m = G.mission;
  m.stepIdx++;
  m.holdTimer = 0;
  m.timeLeft = 0;
  G.sfx.pickup();
  if (m.stepIdx >= m.def.steps.length) {
    completeMission(G);
  } else {
    G.message = note;
    G.messageTimer = 3;
    G.dialogue = currentStep(G).text;
    G.dialogueTimer = 4;
  }
}

function completeMission(G) {
  const m = G.mission;
  const reward = m.def.reward;
  G.player.cash += reward;
  G.stats.missionsDone++;
  G.sfx.missionComplete();
  G.mission = null;
  G.missionIdx++;
  G.betweenTimer = 0;
  if (G.missionIdx >= MISSIONS.length) {
    G.mode = 'win';
    G.modeTimer = 0;
  } else {
    G.mode = 'complete';
    G.modeTimer = 0;
    G.completeNote = m.def.name + ' complete — ' + formatCash(reward) + ' in the pocket.';
  }
  // Save progress right away.
  if (G.saveNow) G.saveNow();
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m) return;
  G.sfx.missionFailed();
  G.mission = null;
  G.mode = 'failed';
  G.modeTimer = 0;
  G.failedNote = m.def.name + ' failed — ' + reason;
}

// ---- Taxi side hustle -------------------------------------------------------

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) {
    G.taxiTimer = (G.taxiTimer || 0) + dt;
    if (G.taxiTimer > 40 && G.mode === 'play') {
      G.taxiTimer = 0;
      spawnFare(G);
    }
    return;
  }
  if (t.state === 'waiting') {
    // The fare waves from the sidewalk; walk up and press E to pick them up.
    if (t.pickupRequested && G.player.car) {
      t.state = 'riding';
      t.ped.isFare = false;
      t.ped.alive = false; // they are in the car now
      t.ped.fallTimer = 0;
      G.message = 'Fare aboard — take them to the marker.';
      G.messageTimer = 3;
    }
    t.pickupRequested = false;
    // The fare gives up after a while.
    t.waitTimer -= dt;
    if (t.waitTimer <= 0) {
      G.taxi = null;
      G.message = 'The fare got tired of waiting.';
      G.messageTimer = 2;
    }
  } else if (t.state === 'riding') {
    if (dist(G.player.x, G.player.y, t.dest.x, t.dest.y) < 110) {
      const fare = t.fare;
      G.player.cash += fare;
      G.sfx.pickup();
      G.message = 'Fare paid: ' + formatCash(fare) + '. Thanks, driver!';
      G.messageTimer = 3;
      G.taxi = null;
    } else if (!G.player.car) {
      // You got out mid-ride: the fare walks off.
      G.taxi = null;
      G.message = 'The fare left. No tip for you.';
      G.messageTimer = 2;
    }
  }
}

function spawnFare(G) {
  const rng = G.rng;
  // Pick a pedestrian near the player and turn them into a fare.
  const near = G.peds.find((p) => p.alive && dist(p.x, p.y, G.player.x, G.player.y) < 500 && dist(p.x, p.y, G.player.x, G.player.y) > 120);
  if (!near) return;
  const dest = pickDestination(G, rng);
  near.isFare = true;
  G.taxi = {
    ped: near,
    dest,
    fare: 60 + Math.floor(rng() * 9) * 10,
    state: 'waiting',
    waitTimer: 30,
    pickupRequested: false,
  };
  G.message = 'Someone needs a ride — look for the $ marker.';
  G.messageTimer = 3;
}

function pickDestination(G, rng) {
  const roads = G.city.roads;
  return {
    x: roads[Math.floor(rng() * roads.length)],
    y: roads[Math.floor(rng() * roads.length)],
  };
}
