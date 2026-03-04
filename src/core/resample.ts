import { clamp, lerp } from './math';
import type { RoutePoint } from './types';

function interpolatePoint(a: RoutePoint, b: RoutePoint, targetDistM: number): RoutePoint {
  const span = b.distM - a.distM;
  const t = span <= 0 ? 0 : clamp((targetDistM - a.distM) / span, 0, 1);

  let timeIso: string | undefined;
  if (a.timeIso && b.timeIso) {
    const ta = Date.parse(a.timeIso);
    const tb = Date.parse(b.timeIso);
    if (Number.isFinite(ta) && Number.isFinite(tb)) {
      timeIso = new Date(lerp(ta, tb, t)).toISOString();
    }
  }

  return {
    lat: lerp(a.lat, b.lat, t),
    lon: lerp(a.lon, b.lon, t),
    eleM:
      a.eleM !== undefined && b.eleM !== undefined
        ? lerp(a.eleM, b.eleM, t)
        : a.eleM ?? b.eleM,
    timeIso,
    distM: targetDistM,
  };
}

export function resampleByDistance(points: RoutePoint[], stepM = 100): RoutePoint[] {
  if (points.length < 2) {
    return points;
  }
  if (stepM <= 0) {
    throw new Error('stepM must be > 0');
  }

  const totalDistM = points[points.length - 1].distM;
  if (totalDistM <= stepM) {
    return points;
  }

  const resampled: RoutePoint[] = [];
  resampled.push({ ...points[0], distM: 0 });

  let sourceIdx = 0;
  for (let target = stepM; target < totalDistM; target += stepM) {
    while (sourceIdx < points.length - 2 && points[sourceIdx + 1].distM < target) {
      sourceIdx += 1;
    }
    const a = points[sourceIdx];
    const b = points[sourceIdx + 1];
    if (b.distM <= a.distM) {
      continue;
    }
    resampled.push(interpolatePoint(a, b, target));
  }

  resampled.push({ ...points[points.length - 1] });

  return resampled.filter((point, idx) => idx === 0 || point.distM > resampled[idx - 1].distM);
}
