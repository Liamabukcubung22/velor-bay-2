// Velor Bay — tuning constants. All gameplay numbers live here.
export const STEP = 1 / 60;
export const WORLD_W = 3200;
export const WORLD_H = 3200;
export const ROAD_SPACING = 400;
export const ROAD_HALF = 62;
export const SAVE_KEY = 'velorbay.save.v1';
export const BEST_KEY = 'velorbay.best.v1';

// Road centrelines: 200, 600, ... 3000 (8 each way). Beach strip east of x=3060.
export const ROAD_LINES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const BEACH_X = 3060;

export const DISTRICTS = [
  { name: 'North Hills', x0: 0, y0: 0, x1: 1600, y1: 1400, color: '#3f6b4f' },
  { name: 'Marina', x0: 1600, y0: 0, x1: 3060, y1: 1400, color: '#2f6f8f' },
  { name: 'Old Town', x0: 0, y0: 1400, x1: 1600, y1: 3200, color: '#7a5a3a' },
  { name: 'Harbor', x0: 1600, y0: 1400, x1: 3060, y1: 3200, color: '#5a4a6b' },
  { name: 'Beach Road', x0: 3060, y0: 0, x1: 3200, y1: 3200, color: '#c2a878' },
];

// Car types: top speed (px/s), accel, turn rate, size, colour.
export const CAR_TYPES = {
  hatch: { name: 'Hatch', max: 380, accel: 300, turn: 2.6, len: 44, wid: 22, color: '#d8b13c' },
  sedan: { name: 'Sedan', max: 430, accel: 330, turn: 2.5, len: 48, wid: 23, color: '#3c7ad8' },
  taxi: { name: 'Taxi', max: 430, accel: 330, turn: 2.5, len: 48, wid: 23, color: '#e8c832', taxi: true },
  van: { name: 'Van', max: 340, accel: 240, turn: 2.0, len: 56, wid: 26, color: '#c8ccd2' },
  sports: { name: 'Sports', max: 540, accel: 430, turn: 3.0, len: 46, wid: 22, color: '#d83c3c' },
  cop: { name: 'Interceptor', max: 470, accel: 380, turn: 2.9, len: 50, wid: 24, color: '#111318' },
};

export const WALK_SPEED = 185;
export const RUN_SPEED = 265;
export const PLAYER_RADIUS = 13;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 520;
export const RESPRAY_COST = 150;
export const START_MONEY = 50;
export const START_AMMO = 24;
export const START_HEALTH = 100;

// Key mission locations (on roads, so they are reachable by car).
export const PLACES = {
  garage: { x: 600, y: 600, label: 'Garage' },
  safehouse: { x: 1000, y: 1000, label: 'Safehouse' },
  taxiStand: { x: 1800, y: 600, label: 'Taxi Stand' },
  repoSpot: { x: 2600, y: 1400, label: 'Repo Target' },
  cargoPickup: { x: 600, y: 2200, label: 'Cargo Pickup' },
  cargoDrop: { x: 2600, y: 2600, label: 'Cargo Drop' },
  debtSpot: { x: 1400, y: 2600, label: 'The Docks' },
  bank: { x: 2200, y: 1000, label: 'Velor Bank' },
  respray: { x: 1000, y: 1800, label: 'Respray' },
  gunShop: { x: 1800, y: 1800, label: 'Ammo' },
};

export const MISSION_DEFS = [
  {
    id: 1, title: 'Back in the Bay', payout: 400,
    brief: 'Kai is back in Velor Bay. Walk to the garage, take the sedan, and drive it to the safehouse. Keep it clean — the cops here have long memories.',
    steps: [
      { type: 'goto', at: PLACES.garage, text: 'Walk to the garage' },
      { type: 'enterCar', car: 'mission', text: 'Get in the sedan' },
      { type: 'deliver', at: PLACES.safehouse, text: 'Drive to the safehouse' },
    ],
  },
  {
    id: 2, title: 'Fare Dodger', payout: 600,
    brief: 'Mara needs a driver for the night shift. Grab the taxi at the stand and drop three fares around town. No shortcuts through the park — the fares hate that.',
    steps: [
      { type: 'goto', at: PLACES.taxiStand, text: 'Walk to the taxi stand' },
      { type: 'enterCar', car: 'taxi', text: 'Get in the taxi' },
      { type: 'pickup', at: { x: 2200, y: 600 }, text: 'Pick up fare 1 — Marina' },
      { type: 'deliver', at: { x: 600, y: 1400 }, text: 'Drop fare 1 — Old Town' },
      { type: 'pickup', at: { x: 1000, y: 2600 }, text: 'Pick up fare 2 — Harbor' },
      { type: 'deliver', at: { x: 2600, y: 1000 }, text: 'Drop fare 2 — Marina' },
      { type: 'pickup', at: { x: 1800, y: 2200 }, text: 'Pick up fare 3 — Harbor' },
      { type: 'deliver', at: { x: 600, y: 1000 }, text: 'Drop fare 3 — North Hills' },
    ],
  },
  {
    id: 3, title: 'Repo Run', payout: 800,
    brief: 'A sports car in Marina has three missed payments. Steal it — quietly — and bring it back to the garage in one piece. Scratch it and the payout shrinks.',
    steps: [
      { type: 'goto', at: PLACES.repoSpot, text: 'Walk to the repo target' },
      { type: 'stealCar', car: 'sports', text: 'Steal the sports car' },
      { type: 'deliver', at: PLACES.garage, text: 'Bring it back to the garage', care: true },
    ],
  },
  {
    id: 4, title: 'Hot Cargo', payout: 1200,
    brief: 'A crate at the Harbor docks has to reach the south warehouse in 150 seconds. Halfway there the police will be tipped off — expect a 2-star tail. Don\'t stop.',
    steps: [
      { type: 'goto', at: PLACES.cargoPickup, text: 'Walk to the cargo pickup' },
      { type: 'enterCar', car: 'any', text: 'Get in any car' },
      { type: 'pickup', at: PLACES.cargoPickup, text: 'Grab the cargo', timed: 150 },
      { type: 'deliverTimed', at: PLACES.cargoDrop, time: 150, text: 'Deliver the cargo — fast!' },
    ],
  },
  {
    id: 5, title: 'The Debt Collector', payout: 1500,
    brief: 'Rook\'s collectors are waiting at the docks to collect on your sister\'s debt — in person. Deal with all four of them on foot, then lose the 3-star heat in a car.',
    steps: [
      { type: 'goto', at: PLACES.debtSpot, text: 'Walk to the docks' },
      { type: 'killAll', at: PLACES.debtSpot, count: 4, text: 'Deal with the collectors (0/4)' },
      { type: 'escape', text: 'Get in a car and escape the heat' },
    ],
  },
  {
    id: 6, title: 'The Last Score', payout: 5000,
    brief: 'One last job and the debt is gone. Steal a car, hit Velor Bank on foot, grab the cash, and outrun a 4-star manhunt back to the safehouse. This is the whole ball game.',
    steps: [
      { type: 'stealCar', car: 'any', text: 'Steal a car' },
      { type: 'deliver', at: PLACES.bank, text: 'Drive to Velor Bank' },
      { type: 'pickup', at: PLACES.bank, text: 'Grab the cash on foot', onFoot: true },
      { type: 'escape', text: 'Escape the 4-star heat — reach the safehouse' },
    ],
  },
];
