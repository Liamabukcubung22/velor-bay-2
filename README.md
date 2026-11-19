# Velor Bay — Open-World Street Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Liamabukcubung22/velor-bay-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Liamabukcubung22/velor-bay-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down open-world street story in the spirit of GTA 1/2, built with
vanilla JS, Canvas 2D and zero libraries — and zero network requests. Play it
in the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on make.fun.

## The story

Kai Mercer, 28, ex-getaway driver, is back in the fictional coastal city of
**Velor Bay** to pay off his little brother's debt. Five districts — Harbor,
Old Town, Marina, North Hills and Beach Road — a procedural grid of avenues,
parks and beachfront, traffic that follows the roads, pedestrians on the
sidewalks, and police who really do chase you.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, or drive when in a car |
| Shift | Run |
| E | Enter / steal a car (stealing a civilian car raises wanted) |
| Space | Handbrake |
| Mouse + click | Aim and shoot the pistol |
| F | Punch |
| P / Esc | Pause |
| M | Mute |
| R | Restart after BUSTED / WASTED |

**Wanted (0–5★):** stealing, shooting, hitting pedestrians or police raises
your wanted level. Interceptors spawn and ram you; get caught while slow and
you're **BUSTED**. Hide out of sight to cool down, or pay **$150 at the
Respray shop** to wipe the heat.

**Missions (6, chained):** Back in the Bay → Fare Dodger → Repo Run →
Hot Cargo → The Debt Collector → The Last Score. Finish all six for the
victory screen and free roam. Progress, money and stats save to localStorage.

## Run it locally

```sh
node serve.ts
# open http://localhost:8080/game/
```

## Screenshots

Deterministic scenes via `?shot=`:

```sh
node tools/shots.mjs   # renders screenshots/1-drive.jpg … 4-mission.jpg
node tools/playtest.mjs # 25 automated checks in headless Chromium
```

## Tech

- Fixed timestep (1/60s), seeded RNG, procedural city and art — all original.
- Synthesized WebAudio: engine hum, two-tone siren, gunshots, pickups,
  mission jingles and an A-minor ambient loop. No audio files.
- `main.ts` builds the submission dossier with the make.fun kit
  (`vendor/makefun-game.ts`): `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## License

MIT — see [LICENSE](LICENSE).
