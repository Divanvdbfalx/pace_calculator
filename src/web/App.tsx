import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCustomSegments,
  customSegmentsToCsv,
  customSegmentsToJson,
  type Checkpoint,
} from '../core/customSegments';
import { DEFAULT_CONSTRAINTS } from '../core/config';
import { RIDER_LEVEL_PROFILES } from '../core/riderLevels';
import { buildPlanFromPreparedCourse, prepareCourseFromGpx } from '../core/pipeline';
import { formatDuration, parseHhMmSs } from '../core/time';
import type { BuildPlanResult } from '../core/pipeline';
import type { RiderLevel } from '../core/types';
import { Charts } from './components/Charts';
import { CustomSegmentsTable } from './components/CustomSegmentsTable';
import { GradientPaceTable } from './components/GradientPaceTable';
import { RouteMap } from './components/RouteMap';
import { SegmentsTable } from './components/SegmentsTable';
import { StatCard } from './components/StatCard';

const LOCAL_STORAGE_KEY = 'pacepro.session.v1';
const ROUTE_PRESETS = [
  { label: 'Cape Town Cycle Tour (109km)', gpxFile: 'Cape-Town-Cycle-Tour-109km.gpx' },
  { label: '99er Cycle Tour 2026 (95km)', gpxFile: '99er-Cycle-Tour-2026-95km.gpx' },
  { label: 'Winelands Cycle Tour (102km)', gpxFile: 'Winelands-Cycle-Tour-102km.gpx' },
] as const;

interface SavedSession {
  version: 1;
  gpxXml: string;
  targetTime: string;
  targetAvgSpeed: string;
  uphillBias: number;
  splitBias: number;
  riderLevel: RiderLevel;
  checkpoints: Checkpoint[];
}

function normalizeCheckpoint(raw: Partial<Checkpoint>, fallbackIndex: number): Checkpoint | null {
  if (typeof raw.km !== 'number' || !Number.isFinite(raw.km)) {
    return null;
  }

  const name = typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : `CP ${fallbackIndex + 1}`;
  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : `cp-${fallbackIndex}-${Math.random()}`;

  return {
    id,
    name,
    km: raw.km,
  };
}

function normalizeSavedSession(raw: unknown): SavedSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Partial<SavedSession>;
  if (typeof value.gpxXml !== 'string') {
    return null;
  }

  const checkpointsRaw = Array.isArray(value.checkpoints) ? value.checkpoints : [];
  const checkpoints = checkpointsRaw
    .map((cp, idx) => normalizeCheckpoint(cp as Partial<Checkpoint>, idx))
    .filter((cp): cp is Checkpoint => cp !== null)
    .sort((a, b) => a.km - b.km);

  return {
    version: 1,
    gpxXml: value.gpxXml,
    targetTime: typeof value.targetTime === 'string' ? value.targetTime : '04:00:00',
    targetAvgSpeed: typeof value.targetAvgSpeed === 'string' ? value.targetAvgSpeed : '',
    uphillBias:
      typeof value.uphillBias === 'number' && Number.isFinite(value.uphillBias)
        ? Math.max(-1, Math.min(1, value.uphillBias))
        : 0,
    splitBias:
      typeof value.splitBias === 'number' && Number.isFinite(value.splitBias)
        ? Math.max(-1, Math.min(1, value.splitBias))
        : 0,
    riderLevel:
      value.riderLevel === 'beginner' ||
      value.riderLevel === 'intermediate' ||
      value.riderLevel === 'advanced' ||
      value.riderLevel === 'pro'
        ? value.riderLevel
        : 'intermediate',
    checkpoints,
  };
}

function loadSavedSessionFromLocalStorage(): SavedSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeSavedSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

function downloadText(filename: string, text: string, contentType: string): void {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const initialSavedSession = useMemo(() => loadSavedSessionFromLocalStorage(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [gpxXml, setGpxXml] = useState<string>(initialSavedSession?.gpxXml ?? '');
  const [targetTime, setTargetTime] = useState<string>(initialSavedSession?.targetTime ?? '04:00:00');
  const [targetAvgSpeed, setTargetAvgSpeed] = useState<string>(initialSavedSession?.targetAvgSpeed ?? '');
  const [uphillBias, setUphillBias] = useState<number>(initialSavedSession?.uphillBias ?? 0);
  const [splitBias, setSplitBias] = useState<number>(initialSavedSession?.splitBias ?? 0);
  const [riderLevel, setRiderLevel] = useState<RiderLevel>(initialSavedSession?.riderLevel ?? 'intermediate');
  const [selectedRouteGpx, setSelectedRouteGpx] = useState<string>('Cape-Town-Cycle-Tour-109km.gpx');
  const [result, setResult] = useState<BuildPlanResult | null>(null);
  const [error, setError] = useState<string>('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(initialSavedSession?.checkpoints ?? []);

  const preparedCourseState = useMemo(() => {
    if (!gpxXml.trim()) {
      return { preparedCourse: null, parseError: '' };
    }

    try {
      return { preparedCourse: prepareCourseFromGpx(gpxXml), parseError: '' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse GPX.';
      return { preparedCourse: null, parseError: message };
    }
  }, [gpxXml]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const session: SavedSession = {
      version: 1,
      gpxXml,
      targetTime,
      targetAvgSpeed,
      uphillBias,
      splitBias,
      riderLevel,
      checkpoints,
    };

    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore quota/storage errors; explicit Save Progress still works.
    }
  }, [checkpoints, gpxXml, riderLevel, splitBias, targetAvgSpeed, targetTime, uphillBias]);

  async function onFileSelected(file: File | null): Promise<void> {
    if (!file) {
      return;
    }
    try {
      setError('');
      const text = await file.text();
      setGpxXml(text);
      setCheckpoints([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read GPX file.';
      setError(message);
      setResult(null);
    }
  }

  async function onOpenProgressFile(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = normalizeSavedSession(JSON.parse(text));
      if (!parsed) {
        throw new Error('Invalid progress file format.');
      }

      setGpxXml(parsed.gpxXml);
      setTargetTime(parsed.targetTime);
      setTargetAvgSpeed(parsed.targetAvgSpeed);
      setUphillBias(parsed.uphillBias);
      setSplitBias(parsed.splitBias);
      setRiderLevel(parsed.riderLevel);
      setCheckpoints(parsed.checkpoints);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open progress file.';
      setError(message);
      setResult(null);
    }
  }

  async function onLoadSelectedRoute(): Promise<void> {
    const gpxUrl = `/routes/${selectedRouteGpx}`;
    const gpxBase = selectedRouteGpx.replace(/\.gpx$/i, '');
    const baseNoDistance = gpxBase.replace(/-\d+km$/i, '');
    const segmentCandidates = [
      `/routes/${gpxBase}-Segments.json`,
      `/routes/${baseNoDistance}-Segments.json`,
      `/routes/${gpxBase}-segments.json`,
      `/routes/${baseNoDistance}-segments.json`,
    ];

    try {
      const gpxResp = await fetch(gpxUrl, { cache: 'no-store' });
      if (!gpxResp.ok) {
        throw new Error(`Could not load route GPX ${gpxUrl} (${gpxResp.status}).`);
      }

      const gpxText = await gpxResp.text();
      const trimmedGpx = gpxText.trim();
      if (trimmedGpx.startsWith('<!doctype') || trimmedGpx.startsWith('<html')) {
        throw new Error(`Found HTML instead of GPX at ${gpxUrl}. Put route GPX files in /public/routes.`);
      }

      setGpxXml(gpxText);

      let loadedCheckpoints = false;
      for (const segmentsUrl of segmentCandidates) {
        const segResp = await fetch(segmentsUrl, { cache: 'no-store' });
        if (!segResp.ok) {
          continue;
        }

        const segText = await segResp.text();
        const trimmedSeg = segText.trim();
        if (
          trimmedSeg.startsWith('<!doctype') ||
          trimmedSeg.startsWith('<html') ||
          trimmedSeg.startsWith('<?xml')
        ) {
          continue;
        }

        const parsed = normalizeSavedSession(JSON.parse(segText));
        if (!parsed) {
          continue;
        }

        setCheckpoints(parsed.checkpoints);
        loadedCheckpoints = true;
        break;
      }

      if (!loadedCheckpoints) {
        setCheckpoints([]);
      }
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load selected route.';
      setError(message);
    }
  }

  function saveProgressFile(): void {
    const session: SavedSession = {
      version: 1,
      gpxXml,
      targetTime,
      targetAvgSpeed,
      uphillBias,
      splitBias,
      riderLevel,
      checkpoints,
    };

    downloadText('Cape-Town-Cycle-Tour-Segments.json', JSON.stringify(session, null, 2), 'application/json');
  }

  function clearSavedLocalData(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  useEffect(() => {
    if (!gpxXml.trim()) {
      setResult(null);
      setError('');
      return;
    }

    if (!preparedCourseState.preparedCourse) {
      setResult(null);
      setError(preparedCourseState.parseError || 'Failed to parse GPX.');
      return;
    }

    try {
      let targetTimeSec: number | undefined;
      let targetAvgSpeedKmh: number | undefined;

      if (targetTime.trim()) {
        targetTimeSec = parseHhMmSs(targetTime);
      }

      if (targetAvgSpeed.trim()) {
        const speed = Number(targetAvgSpeed);
        if (!Number.isFinite(speed) || speed <= 0) {
          throw new Error('Target avg speed must be a positive number.');
        }
        targetAvgSpeedKmh = speed;
      }

      const build = buildPlanFromPreparedCourse({
        preparedCourse: preparedCourseState.preparedCourse,
        targetTimeSec,
        targetAvgSpeedKmh,
        uphillBias,
        splitBias,
        riderLevel,
        constraints: DEFAULT_CONSTRAINTS,
      });

      setResult(build);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate pacing plan.';
      setError(message);
      setResult(null);
    }
  }, [gpxXml, preparedCourseState, riderLevel, splitBias, targetAvgSpeed, targetTime, uphillBias]);

  const customSegments = useMemo(() => {
    if (!result) {
      return [];
    }

    return buildCustomSegments(result.plan.segments, checkpoints, result.plan.summary.totalDistanceKm);
  }, [checkpoints, result]);

  function addCheckpoint(distanceKm: number): void {
    if (!result) {
      return;
    }
    const totalDistanceKm = result.plan.summary.totalDistanceKm;
    if (distanceKm <= 0 || distanceKm >= totalDistanceKm) {
      return;
    }

    const roundedKm = Math.round(distanceKm * 1000) / 1000;
    const defaultName = `CP ${checkpoints.length + 1}`;
    const entered = window.prompt('Checkpoint name', defaultName);
    if (!entered) {
      return;
    }

    setCheckpoints((prev) =>
      [...prev, { id: `${Date.now()}-${Math.random()}`, km: roundedKm, name: entered.trim() }]
        .filter((cp) => cp.name.length > 0)
        .sort((a, b) => a.km - b.km),
    );
  }

  function renameCheckpoint(id: string): void {
    const current = checkpoints.find((cp) => cp.id === id);
    if (!current) {
      return;
    }
    const entered = window.prompt('Rename checkpoint', current.name);
    if (!entered) {
      return;
    }

    const nextName = entered.trim();
    if (!nextName) {
      return;
    }

    setCheckpoints((prev) => prev.map((cp) => (cp.id === id ? { ...cp, name: nextName } : cp)));
  }

  function removeCheckpoint(id: string): void {
    setCheckpoints((prev) => prev.filter((cp) => cp.id !== id));
  }

  return (
    <div className="app-shell">
      <header className="app-hero panel">
        <div className="hero-kicker">PacePro Studio</div>
        <h1>PacePro for Cycling (Speed-Based)</h1>
        <p>Upload GPX, set target, tune uphill effort and split behavior.</p>
      </header>

      <section className="panel controls">
        <div className="field-row">
          <label>GPX File</label>
          <input type="file" accept=".gpx,application/gpx+xml,text/xml" onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)} />
        </div>

        <div className="field-grid">
          <div className="field-row">
            <label>Target Time (HH:MM:SS)</label>
            <input value={targetTime} onChange={(e) => setTargetTime(e.target.value)} placeholder="04:00:00" />
          </div>
          <div className="field-row">
            <label>Target Avg Speed (km/h, optional)</label>
            <input
              value={targetAvgSpeed}
              onChange={(e) => setTargetAvgSpeed(e.target.value)}
              placeholder="27.0"
              type="number"
              step="0.1"
              min="1"
            />
          </div>
        </div>

        <div className="field-row">
          <label>Uphill Effort Bias: {uphillBias.toFixed(2)}</label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={uphillBias}
            onChange={(e) => setUphillBias(Number(e.target.value))}
          />
        </div>

        <div className="field-row">
          <label>Split Bias: {splitBias.toFixed(2)} (+: negative split, -: positive split)</label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={splitBias}
            onChange={(e) => setSplitBias(Number(e.target.value))}
          />
        </div>

        <div className="field-row">
          <label>Rider Level</label>
          <select value={riderLevel} onChange={(e) => setRiderLevel(e.target.value as RiderLevel)}>
            {(Object.keys(RIDER_LEVEL_PROFILES) as RiderLevel[]).map((level) => (
              <option key={level} value={level}>
                {RIDER_LEVEL_PROFILES[level].label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <label>Route Preset</label>
          <select value={selectedRouteGpx} onChange={(e) => setSelectedRouteGpx(e.target.value)}>
            {ROUTE_PRESETS.map((route) => (
              <option key={route.gpxFile} value={route.gpxFile}>
                {route.label}
              </option>
            ))}
          </select>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            onOpenProgressFile(e.target.files?.[0] ?? null);
            e.currentTarget.value = '';
          }}
        />

        <div className="button-row">
          <button className="btn-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
            Open Progress
          </button>
          <button className="btn-secondary" type="button" onClick={onLoadSelectedRoute}>
            Load Selected Route
          </button>
          <button className="btn-primary" type="button" onClick={saveProgressFile} disabled={!gpxXml.trim()}>
            Save Progress
          </button>
          <button className="btn-danger" type="button" onClick={clearSavedLocalData}>
            Clear Remembered
          </button>
        </div>

        {initialSavedSession && <p className="hint-text">Last session restored automatically on load.</p>}
        {error && <p className="error">{error}</p>}
        {result?.plan.warning && <p className="warning">{result.plan.warning}</p>}
      </section>

      {result && (
        <>
          <section className="stats-grid">
            <StatCard label="Distance" value={`${result.plan.summary.totalDistanceKm.toFixed(2)} km`} />
            <StatCard label="Ascent" value={`${result.plan.summary.totalAscentM.toFixed(0)} m`} />
            <StatCard label="Descent" value={`${result.plan.summary.totalDescentM.toFixed(0)} m`} />
            <StatCard label="Target Time" value={formatDuration(result.plan.summary.targetFinishTimeS)} />
            <StatCard label="Predicted Time" value={formatDuration(result.plan.summary.predictedFinishTimeS)} />
            <StatCard label="Finish Delta" value={`${result.plan.summary.finishDeltaS.toFixed(2)} s`} />
            <StatCard label="Avg Speed" value={`${result.plan.summary.avgSpeedKmh.toFixed(2)} km/h`} />
            <StatCard label="Segments" value={`${result.plan.segments.length}`} />
          </section>

          <Charts
            segments={result.plan.segments}
            profile={result.resampledPoints}
            checkpoints={checkpoints}
            onElevationClick={addCheckpoint}
          />
          <RouteMap profile={result.resampledPoints} checkpoints={checkpoints} />
          <section className="panel checkpoint-panel">
            <h3>Checkpoints</h3>
            {checkpoints.length === 0 && <p className="hint-text">No checkpoints yet. Click on the elevation chart to add one.</p>}
            {checkpoints.length > 0 && (
              <div className="checkpoint-list">
                {checkpoints.map((checkpoint) => (
                  <div key={checkpoint.id} className="checkpoint-item">
                    <span>
                      {checkpoint.name} ({checkpoint.km.toFixed(2)} km)
                    </span>
                    <div className="checkpoint-actions">
                      <button className="btn-secondary btn-small" type="button" onClick={() => renameCheckpoint(checkpoint.id)}>
                        Rename
                      </button>
                      <button className="btn-danger btn-small" type="button" onClick={() => removeCheckpoint(checkpoint.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <CustomSegmentsTable segments={customSegments} />
          <section className="panel export-panel">
            <h3>Custom Segment Exports</h3>
            <div className="button-row">
              <button
                className="btn-ghost"
                onClick={() => downloadText('pacepro-custom-segments.csv', customSegmentsToCsv(customSegments), 'text/csv')}
                disabled={customSegments.length === 0}
              >
                Download Custom CSV
              </button>
              <button
                className="btn-ghost"
                onClick={() =>
                  downloadText('pacepro-custom-segments.json', customSegmentsToJson(customSegments), 'application/json')
                }
                disabled={customSegments.length === 0}
              >
                Download Custom JSON
              </button>
            </div>
          </section>
          <SegmentsTable segments={result.plan.segments} />
          <section className="panel export-panel">
            <h3>Plan Exports</h3>
            <div className="button-row">
              <button className="btn-ghost" onClick={() => downloadText('pacepro-plan.csv', result.csv, 'text/csv')}>Download Plan CSV</button>
              <button className="btn-ghost" onClick={() => downloadText('pacepro-plan.json', result.json, 'application/json')}>Download Plan JSON</button>
            </div>
          </section>
          <GradientPaceTable selectedLevel={riderLevel} />
        </>
      )}
    </div>
  );
}
