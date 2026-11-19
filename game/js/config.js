// Velor Bay — tuning numbers. One place for every speed, price and payout
// so the feel of the game can be balanced without hunting through logic.
export const CFG = {
  worldW: 3200,
  worldH: 2400,
  roadGap: 400,      // distance between parallel roads
  roadW: 76,         // drivable asphalt width
  tile: 40,
  tick: 1 / 60,      // fixed timestep, seconds
  walkSpeed: 170,
  runSpeed: 265,
  carAccel: 320,
  carBrake: 520,
  carMaxSpeed: 430,
  carMaxReverse: 150,
  carTurn: 2.6,
  handbrakeTurn: 4.2,
  trafficCount: 26,
  pedCount: 42,
  policeMax: 6,
  resprayCost: 150,
  startMoney: 200,
  startAmmo: 24,
  maxHealth: 100,
  maxWanted: 5,
  bulletSpeed: 900,
  bulletDamage: 34,
  gangDamage: 8,
  bustHoldSeconds: 2.2,
  wantedCoolSeconds: 6,
  payouts: [400, 600, 800, 1000, 1500, 3000],
  colors: {
    asphalt: '#33363d',
    asphaltLine: '#d8c95a',
    sidewalk: '#8d8a80',
    grass: '#4d7a3d',
    sand: '#d9c48a',
    water: '#2e6f8e',
    roof: ['#b0563a', '#7a6fb0', '#4f8a6d', '#a08a3c', '#5d7ea6', '#96506e'],
    car: ['#c23b2e', '#2e6fc2', '#d8a018', '#3f9e5f', '#7a4fb0', '#c2c2c2', '#222831'],
  },
};

// District lookup by position. North Hills is the top strip, Marina hugs the
// beach on the east, Harbor sits south-west, Old Town is the middle.
export function districtAt(x, y) {
  if (x >= 2960) return 'Beach Road';
  if (x >= 2400) return 'Marina';
  if (y < 500) return 'North Hills';
  if (x < 900 && y > 1700) return 'Harbor';
  return 'Old Town';
}

// In-game clock: one game minute per real second, starting at 09:12.
export function clockString(minutes) {
  const total = 9 * 60 + 12 + Math.floor(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
