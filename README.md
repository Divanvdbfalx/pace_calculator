# PacePro Cycling (Speed-Based)

Speed-based pacing planner for cycling GPX routes. It generates per-segment target speeds and predicted splits to match a target finish time.

## Features

- GPX parsing (`lat/lon/ele/time` when available)
- Distance-based resampling (default 100 m)
- Grade-band segmentation with merge for short segments (<300 m)
- Deterministic speed planner with:
  - rider level profile (`Beginner` / `Intermediate` / `Advanced` / `Pro`)
  - uphill effort bias slider `[-1, 1]`
  - split bias slider `[-1, 1]`
  - speed floor/caps, steep descent cap, adjacent speed smoothing
- Time-matching optimizer (hits target within ~1-2 seconds when feasible)
- Exports to CSV and JSON
- Minimal web UI for upload + controls + charts + table
- Click-to-add named checkpoints on elevation chart to build custom target segments
- Auto-remembers last session (GPX + sliders + targets + checkpoints)
- Save/Open full progress as JSON session files
- Elevation tooltip shows distance, elevation, and local gradient (%)
- Gradient pace table (beginner/intermediate/advanced/pro) shown in UI
- CLI sample runner writing `/out/plan.csv` and `/out/plan.json`

## Project Layout

- `/Users/divanvanderbank/Documents/PacePro/src/core` core logic
- `/Users/divanvanderbank/Documents/PacePro/src/web` minimal React UI
- `/Users/divanvanderbank/Documents/PacePro/src/cli/sample.ts` CLI sample generator
- `/Users/divanvanderbank/Documents/PacePro/tests` unit + integration tests
- `/Users/divanvanderbank/Documents/PacePro/examples/example.gpx` sample GPX
- `/Users/divanvanderbank/Documents/PacePro/out` generated outputs

## Install

```bash
npm install
```

## Run Tests

```bash
npm test
```

## Run Web UI

```bash
npm run dev
```

Open the local Vite URL, upload GPX, enter target time, tune sliders, and generate plan.
The plan updates automatically whenever inputs change.

Progress workflow:

- `Save Progress` downloads a session JSON snapshot.
- `Open Progress` restores a previously saved session JSON.
- Last-used session is also remembered automatically in browser local storage.

## Build

```bash
npm run build
```

## Generate Sample Plan (CLI)

Default:

```bash
npm run sample
```

Custom:

```bash
npm run sample -- --gpx examples/example.gpx --target-time 04:00:00 --uphill-bias 0.2 --split 0.3
```

This writes:

- `/Users/divanvanderbank/Documents/PacePro/out/plan.csv`
- `/Users/divanvanderbank/Documents/PacePro/out/plan.json`

## Input and Output Notes

- If both target time and target avg speed are provided, target time is authoritative.
- Default safety constraints:
  - min speed: 5 km/h
  - max speed: 65 km/h
  - steep descent threshold: grade < -4%
  - steep descent cap: 50 km/h
  - adjacent speed smoothing delta: 6 km/h

CSV columns:

- `segment_index,start_km,end_km,length_m,avg_grade,target_speed_kmh,predicted_time_s,cumulative_time_s`

Custom checkpoint CSV columns:

- `segment_index,start_checkpoint,end_checkpoint,start_km,end_km,length_m,avg_grade,target_speed_kmh,predicted_time_s,cumulative_time_s`

JSON includes:

- `summary`
- `warning` (when target is infeasible under constraints)
- `segments`
