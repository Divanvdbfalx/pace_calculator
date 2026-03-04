import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { Checkpoint } from '../../core/customSegments';
import type { PlannedSegment, RoutePoint } from '../../core/types';

interface ChartsProps {
  segments: PlannedSegment[];
  profile: RoutePoint[];
  checkpoints: Checkpoint[];
  onElevationClick: (distanceKm: number) => void;
  hoverDistanceKm: number | null;
  onHoverDistanceChange: (distanceKm: number | null) => void;
}

function extractNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.+-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractDistance(value: unknown): number | null {
  const direct = extractNumeric(value);
  if (direct !== null) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const obj = value as Record<string, unknown>;

  const candidates = [
    obj.distanceKm,
    obj.value,
    obj.tick,
    obj.label,
    obj.activeLabel,
    (obj.payload as Record<string, unknown> | undefined)?.distanceKm,
    (obj.payload as Record<string, unknown> | undefined)?.value,
    (obj.payload as Record<string, unknown> | undefined)?.label,
  ];

  for (const candidate of candidates) {
    const parsed = extractNumeric(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function readActiveDistanceFromChartState(state: unknown): number | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const typed = state as {
    activeLabel?: unknown;
    activePayload?: Array<{ payload?: Record<string, unknown> }>;
  };

  const fromLabel = extractDistance(typed.activeLabel);
  if (fromLabel !== null) {
    return fromLabel;
  }

  const payload = typed.activePayload?.[0]?.payload;
  return extractDistance(payload);
}

type ElevationDatum = {
  distanceKm: number;
  elevationM: number;
  gradientPct: number;
};

function ElevationTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0]?.payload as ElevationDatum | undefined;
  if (!row) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <div><strong>{row.distanceKm.toFixed(2)} km</strong></div>
      <div>Elevation: {row.elevationM.toFixed(1)} m</div>
      <div>Gradient: {row.gradientPct.toFixed(2)}%</div>
    </div>
  );
}

function nearestSpeedDistance(distanceKm: number, speedData: Array<{ distanceKm: number }>): number {
  if (speedData.length === 0) {
    return distanceKm;
  }

  let best = speedData[0].distanceKm;
  let bestDelta = Math.abs(best - distanceKm);

  for (let i = 1; i < speedData.length; i += 1) {
    const candidate = speedData[i].distanceKm;
    const delta = Math.abs(candidate - distanceKm);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }

  return best;
}

export function Charts({ segments, profile, checkpoints, onElevationClick, hoverDistanceKm, onHoverDistanceChange }: ChartsProps) {
  const speedData = segments.map((segment) => ({
    distanceKm: segment.endKm,
    speedKmh: segment.targetSpeedKmh,
  }));

  const elevationPoints = profile.filter((p) => p.eleM !== undefined);
  const elevationData: ElevationDatum[] = elevationPoints.map((point, idx) => {
    const prev = elevationPoints[Math.max(0, idx - 1)];
    const next = elevationPoints[Math.min(elevationPoints.length - 1, idx + 1)];
    const deltaDistM = next.distM - prev.distM;
    const deltaEleM = (next.eleM ?? point.eleM ?? 0) - (prev.eleM ?? point.eleM ?? 0);
    const gradientPct = deltaDistM > 0 ? (deltaEleM / deltaDistM) * 100 : 0;

    return { distanceKm: point.distM / 1000, elevationM: point.eleM!, gradientPct };
  });
  const maxDistanceKm = elevationData.length > 0 ? elevationData[elevationData.length - 1].distanceKm : 0;

  return (
    <div className="charts-grid">
      <div className="panel chart-panel">
        <h3>Target Speed vs Distance</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={speedData}
            onMouseMove={(state) => {
              const distance = readActiveDistanceFromChartState(state);
              if (distance !== null) {
                onHoverDistanceChange(nearestSpeedDistance(distance, speedData));
              }
            }}
            onMouseLeave={() => onHoverDistanceChange(null)}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="distanceKm" tickFormatter={(v) => `${Number(v).toFixed(1)} km`} minTickGap={40} />
            <YAxis unit=" km/h" />
            <Tooltip />
            <Line type="monotone" dataKey="speedKmh" stroke="#0f766e" strokeWidth={2} dot={false} />
            {hoverDistanceKm !== null && <ReferenceLine x={hoverDistanceKm} stroke="#2563eb" strokeDasharray="6 4" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel chart-panel">
        <h3>Elevation vs Distance</h3>
        <p className="hint-text">Click the elevation chart to add a named checkpoint. Names and distances are listed in the Checkpoints panel.</p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={elevationData}
            onMouseMove={(state) => {
              const distance = readActiveDistanceFromChartState(state);
              if (distance !== null) {
                onHoverDistanceChange(nearestSpeedDistance(distance, speedData));
              }
            }}
            onMouseLeave={() => onHoverDistanceChange(null)}
            onClick={(state) => {
              const distance = readActiveDistanceFromChartState(state);
              if (distance !== null) {
                onElevationClick(distance);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="distanceKm"
              tickFormatter={(v) => `${Number(v).toFixed(1)} km`}
              domain={[0, maxDistanceKm || 'dataMax']}
              minTickGap={48}
            />
            <YAxis unit=" m" />
            <Tooltip content={<ElevationTooltip />} />
            <Line type="monotone" dataKey="elevationM" stroke="#b45309" strokeWidth={2} dot={false} />
            {hoverDistanceKm !== null && <ReferenceLine x={hoverDistanceKm} stroke="#2563eb" strokeDasharray="6 4" />}
            {checkpoints.map((checkpoint) => (
              <ReferenceLine
                key={checkpoint.id}
                x={checkpoint.km}
                stroke="#dc2626"
                strokeDasharray="4 4"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
