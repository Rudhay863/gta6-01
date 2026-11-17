// city.js — builds Solmar Bay, the original sun-soaked coastal city of the game.
// A fixed seed makes the layout identical on every load. All coordinates are in
// world pixels; the world is WORLD x WORLD, roads on a 450 px grid, the beach
// and the sea along the south edge, a park at the centre.

import { mulberry32, pick, randRange, randInt, circleHitsRect } from './util.js';

export const WORLD = 3600;
export const ROAD_SPACING = 450;
export const ROAD_WIDTH = 96;
export const BEACH_TOP = 3150; // sand starts here
export const WATER_TOP = 3380; // sea starts here

const ROAD_LINES = [225, 675, 1125, 1575, 2025, 2475, 2925, 3375];

const BUILDING_COLORS = [
  '#e8b4a0', '#d9a05b', '#c97b63', '#a8c3a0', '#8fb8c9', '#d8c27a',
  '#b08968', '#e0a899', '#9db8a6', '#c9a227', '#7fa3b8', '#e6c9a8',
];
const ROOF_COLORS = ['#5b6b7a', '#7a5b4f', '#4f6b5b', '#8a7a5b', '#6b5b7a', '#546a7a'];

const CAR_COLORS = [
  '#d94f3d', '#3d7ad9', '#e8c53d', '#4fd93d', '#e8e8e8', '#2b2b2b',
  '#d97ad9', '#3dd9c9', '#f08c1e', '#8c5ad9', '#c9c9c9', '#7a4a2b',
];

export function buildCity() {
  const rng = mulberry32(20261117);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Named places the story uses. All sit beside a road so cars can reach them.
  const places = {
    garage: { x: 675, y: 600, name: 'Mara\u2019s Garage' },
    dock: { x: 3300, y: 1575, name: 'Coral Docks' },
    safehouse: { x: 1125, y: 2400, name: 'Safehouse' },
    bank: { x: 1575, y: 1050, name: 'Bayfront Bank' },
    hideout: { x: 2475, y: 2850, name: 'Hideout' },
    yacht: { x: 2925, y: 3220, name: 'Yacht Marina' },
    hospital: { x: 675, y: 2400, name: 'Solmar General' },
    casino: { x: 2025, y: 675, name: 'Palma Casino' },
  };

  // Blocks: the squares between neighbouring road lines. Skip the beach strip
  // (south row) and the central park block.
  const parkBlock = { x0: 1221, y0: 1221, x1: 2025 - 96, y1: 2025 - 96 };
  for (let bi = 0; bi < ROAD_LINES.length - 1; bi++) {
    for (let bj = 0; bj < ROAD_LINES.length - 1; bj++) {
      const x0 = ROAD_LINES[bi] + ROAD_WIDTH / 2 + 14;
      const x1 = ROAD_LINES[bi + 1] - ROAD_WIDTH / 2 - 14;
      const y0 = ROAD_LINES[bj] + ROAD_WIDTH / 2 + 14;
      const y1 = ROAD_LINES[bj + 1] - ROAD_WIDTH / 2 - 14;
      if (y0 > BEACH_TOP) continue; // beach row stays open sand
      const isPark =
        x0 >= parkBlock.x0 - 10 && x1 <= parkBlock.x1 + 10 &&
        y0 >= parkBlock.y0 - 10 && y1 <= parkBlock.y1 + 10;
      if (isPark) {
        // Park trees, scattered but kept off the diagonal footpath.
        for (let t = 0; t < 26; t++) {
          const tx = randRange(rng, x0 + 20, x1 - 20);
          const ty = randRange(rng, y0 + 20, y1 - 20);
          if (Math.abs((tx - x0) - (ty - y0)) < 60) continue;
          trees.push({ x: tx, y: ty, r: randRange(rng, 12, 20) });
        }
        continue;
      }
      const downtown =
        ROAD_LINES[bi] >= 1125 && ROAD_LINES[bi] <= 2025 &&
        ROAD_LINES[bj] >= 675 && ROAD_LINES[bj] <= 1575;
      const count = downtown ? randInt(rng, 2, 3) : randInt(rng, 1, 3);
      for (let k = 0; k < count; k++) {
        const bw = randRange(rng, 90, 170);
        const bh = randRange(rng, 90, 170);
        const bx = randRange(rng, x0, Math.max(x0 + 1, x1 - bw));
        const by = randRange(rng, y0, Math.max(y0 + 1, y1 - bh));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ROOF_COLORS),
          tall: downtown && rng() < 0.6,
        });
      }
      // A couple of street trees per block, kept on the block corners.
      for (let t = 0; t < 2; t++) {
        trees.push({
          x: randRange(rng, x0, x1),
          y: randRange(rng, y0, y1),
          r: randRange(rng, 9, 14),
        });
      }
    }
  }

  // Street lamps at every intersection corner.
  for (const rx of ROAD_LINES) {
    for (const ry of ROAD_LINES) {
      lamps.push({ x: rx - ROAD_WIDTH / 2 - 6, y: ry - ROAD_WIDTH / 2 - 6 });
    }
  }

  // Cash stashes hidden around the city (side collectible, $100 each).
  const stashes = [
    { x: 400, y: 400 }, { x: 3200, y: 500 }, { x: 500, y: 2900 },
    { x: 2900, y: 2900 }, { x: 1650, y: 1650 }, { x: 2500, y: 900 },
    { x: 900, y: 1800 }, { x: 3300, y: 2400 },
  ].map((p) => ({ ...p, taken: false }));

  return {
    roads: ROAD_LINES,
    buildings,
    trees,
    lamps,
    places,
    stashes,
    carColors: CAR_COLORS,
    spawn: { x: 675, y: 720 },
  };
}

// True when (x, y) is on a road (with a small margin onto the sidewalk).
export function onRoad(city, x, y) {
  for (const line of city.roads) {
    if (Math.abs(x - line) < ROAD_WIDTH / 2 + 8) return true;
    if (Math.abs(y - line) < ROAD_WIDTH / 2 + 8) return true;
  }
  return false;
}

// True when (x, y) is on sand or in the sea.
export function onBeach(x, y) {
  return y >= BEACH_TOP;
}

export function inWater(x, y) {
  return y >= WATER_TOP;
}

// Nearest point on the road network to (x, y): snaps to the closest road line.
export function nearestRoadPoint(city, x, y) {
  let bestX = city.roads[0];
  let bestY = city.roads[0];
  let bd = Infinity;
  for (const line of city.roads) {
    const d = Math.abs(x - line);
    if (d < bd) { bd = d; bestX = line; }
  }
  bd = Infinity;
  for (const line of city.roads) {
    const d = Math.abs(y - line);
    if (d < bd) { bd = d; bestY = line; }
  }
  // Pick whichever axis is closer to a road.
  if (Math.abs(x - bestX) < Math.abs(y - bestY)) return { x: bestX, y };
  return { x, y: bestY };
}

// True when a circle at (x, y) radius r overlaps any building or the sea.
export function hitsSolid(city, x, y, r) {
  if (inWater(x, y)) return true;
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  return false;
}

// Nearest intersection centre to (x, y).
export function nearestIntersection(city, x, y) {
  let bx = city.roads[0];
  let by = city.roads[0];
  let bd = Infinity;
  for (const rx of city.roads) {
    for (const ry of city.roads) {
      const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < bd) { bd = d; bx = rx; by = ry; }
    }
  }
  return { x: bx, y: by };
}
