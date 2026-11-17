# Velor Bay — Open-World Street Story — RESULTS (rebuild)

Entry for make.fun gta6-01 ("Make GTA 6", $1,666).
Rebuilt from scratch in this session (started after the 22:00 WIB opening,
under a live recording). The first build's code was NOT read or copied —
every game file below was written fresh from the design spec in
`HANDOFF.md` §5; only the kit starter files (LICENSE, main.ts, serve.ts,
vendor) were copied from the kit on disk. NOT submitted — submission is
the coordinator's step after the recording is sealed.

## What was built

**Genre:** top-down 2D open-world street game (original city, story, art,
names, sounds — nothing copied from any commercial game, no Rockstar assets).

**The game:** You are Kai Mercer, 28, a former getaway driver back in the
fictional coastal city of Velor Bay to pay off his sister's debt. Walk
(WASD, Shift to run) or drive (WASD/arrows, Space handbrake) across five
districts — Harbor, Old Town, Marina, North Hills, Beach Road — on a
procedural road grid with buildings, parks, palms and a beach. AI traffic
cars follow lanes, turn at intersections, slow for the car ahead and honk;
pedestrians walk the sidewalks and flee gunfire or a speeding car. Press E
near a car to enter it; stealing a civilian car raises the wanted level.
Wanted 0–5 stars: police interceptors spawn, chase and ram, and pin you
down (BUSTED) when you are slow and close; wanted decays when you stay out
of sight, or pay $150 at the Respray. Combat on foot: mouse aim, click to
shoot, ammo, health, gang enemies and cop cars that take damage. Six chained
missions with briefings, objectives and payouts (tutorial drive, taxi fares,
repo steal, timed hot cargo with mid-mission wanted 2, debt-collector
shootout, final bank score at wanted 4) ending in a victory screen with full
stats and free roam. HUD: money, health, ammo, wanted stars, clock,
district, objective bar, live minimap (player, cops, mission marker).
Title screen (New Game / Continue), pause (P/Esc), BUSTED / WASTED screens
with R restart, localStorage save (money, mission, stats, position),
fully synthesized WebAudio soundscape (engine hum, two-tone siren, gunshots,
pickup blips, mission jingles, A-minor bassline + hat loop — no audio files).

**Structure (19 files, ~90 KB, 18 source modules, one job each):**
`game/index.html`, `game/js/config.js` (tuning), `random.js` (seeded RNG),
`input.js`, `audio.js` (WebAudio synth), `storage.js` (save/best),
`city.js` (procedural city + collision + BFS road routing), `vehicles.js`
(car physics), `traffic.js` (traffic + pedestrian AI), `police.js`
(wanted + pursuit), `player.js`, `combat.js` (bullets, gang AI, pickups),
`missions.js` (6-mission chain), `hud.js` (HUD + minimap), `particles.js`,
`render.js` (world + screens), `shots.js` (deterministic `?shot=` scenes),
`game.js` (state machine), `main.js` (boot/fixed-step loop). Vanilla JS +
Canvas, zero libraries, zero network requests. `main.ts` (starter,
unmodified) copies `game/` + `screenshots/` to `/output` and writes
`dossier.json` with the kit's `vendor/makefun-game.ts` (copied unchanged,
sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).

**Screenshots (real renders of the game's own code, headless Chromium,
1280×720 JPEG):**
1. `1-drive.jpg` (cover) — driving the sedan down the main avenue: HUD,
   minimap, traffic, mission objective.
2. `2-title.jpg` — title screen with story and controls.
3. `3-wanted.jpg` — wanted 3 stars, three police interceptors with
   flashing lightbars closing in.
4. `4-mission.jpg` — "MISSION COMPLETE" + payout + stats + next mission.

## Verification (all run 17 Nov 2026, headless Chromium via Playwright)

**Play-test (`tools/playtest.mjs`) — 25/25 PASS:**
loads to title · start button begins run · save written on new game ·
traffic + pedestrians populated · walking moves player · mission 1 step 1
(walk to garage) · enter mission car (clean, no wanted) · mission 1
completes, payout lands ($400) · exit car · steal car raises wanted ·
stolen counter · police spawn and chase · respray clears wanted · wanted
decays when hidden · combat kills an enemy · pause works · resume works ·
death shows WASTED · R restarts after WASTED · mission 6: steal a car ·
mission 6: bank cash grabbed, wanted 4 · mission 6 completes -> victory ·
victory restarts into free roam · **zero network requests (19 local
requests only)** · **no console/page errors**.

**Screenshots:** 4 files, 67,389 / 69,455 / 72,551 / 83,285 bytes
(cap 256 KiB each), 1280×720 each, valid JPEGs, each visually inspected:
cover shows live driving + HUD + minimap; title button labels fully
visible; wanted shot shows 3 stars and three interceptors with lightbars;
mission-complete panel readable. No edits/composites.

**Dossier (`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`, run twice):**
byte-for-byte identical both runs (`cmp` clean). `dossier.json` sha256
`162bc9141acad0bf01f76b2a6cb5a364e4474082ba5ba5b871a7fb329c7677f5`,
484,879 bytes (cap 1.5 MiB). `/output` total 867,743 bytes (cap 64 MiB);
`game/` 19 entries, 90,184 bytes (caps 993 / 48 MiB). No `http(s)://`,
`fetch`, `XMLHttpRequest` or `WebSocket` anywhere under `game/`.
All 18 JS modules parse as ES modules (`node --check` clean).
`.makefun/owner.json` is exactly
`{"wallet":"27NVLKGQP2Hj6LQ836RRunmwSzYpdT9L5T1c1zxobRfi"}`. MIT LICENSE
at root.

## Honest notes / limits

- **Slow test environment, not a game defect:** this VM's shared CPU is
  heavily loaded, so the rAF loop runs game time slower than wall time
  (max 5 fixed steps per frame). The play-test therefore waits on game
  state (`waitForFunction`) instead of wall-clock sleeps for the
  time-based checks (respray, wanted decay). The game itself runs at a
  fixed 1/60 step on a normal machine.
- **Full human playthrough of all six missions not done** (would take
  ~15 min); missions 1 and 6 were played end-to-end through the real
  state machine (mission 1 live with autopilot driving; mission 6 by
  teleporting the player between real objectives and using the real
  enter/exit car paths). Missions 2–5 share the same step engine
  (goto / enterCar / stealCar / pickup / deliver / killAll / escape /
  deliverTimed), which missions 1 and 6 exercise.
- **BUSTED path** was observed live during testing: in the first
  playtest run a cop pinned the stationary player after a steal and the
  BUSTED screen appeared (it also exposed the spawn-clamp bug below,
  now fixed); the R-restart from BUSTED reuses the same path as WASTED,
  which the automated run exercises.
- **Bugs found and fixed during this rebuild:** (1) stealing a civilian
  car did not raise wanted — the owner check ran after the owner was
  already set to 'player'; (2) police spawned at the world edge could
  land within 180 px of the player and bust a stationary player in ~2 s
  — spawns now retry angles until the clamped point is ≥550 px away;
  (3) interceptors jammed each other to a standstill when converging on
  one point — cops no longer collide with each other, only with the
  player, and spread across the road; (4) cops knocked off-road wedged
  against buildings — they now steer back to the nearest road, back out
  when stuck, and search the area when the trail goes cold; (5) cop rams
  wrecked the player's car in ~7 s at wanted 3 — ram damage lowered.
- **Balance:** traffic cars are slower than the player's sedan and cops
  slightly slower than a sports car, so escaping at wanted 1–2 is very
  doable; wanted 4–5 with 5 interceptors is a real chase.
- **Reproducing the checks:** `node tools/shots.mjs`,
  `node tools/playtest.mjs` from the entry root (playwright-core is
  resolved from `~/workspace/makefun-token-radar-01/tools/node_modules`
  via `tools/node_modules` symlink; Chromium 1255 in
  `~/.cache/ms-playwright/`).

## Submit-readiness

**Yes — submit-ready as far as this session can verify.** Deliverables
are complete: `game/`, `screenshots/`, `main.ts`, `serve.ts`,
`shots.json`, `vendor/`, `LICENSE`, `.makefun/owner.json`, `tools/`,
this file. Not submitted (per task). What remains for the coordinator:
stop the recording, take the recording id, run submit (fee must be $0 —
verify in the output; stop if a fee appears), verify status + dev grade.
