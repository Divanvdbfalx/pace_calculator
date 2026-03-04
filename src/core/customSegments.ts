import type { PlannedSegment } from './types';

export interface Checkpoint {
  id: string;
  km: number;
  name: string;
}

export interface CustomSegmentTarget {
  segmentIndex: number;
  startKm: number;
  endKm: number;
  lengthM: number;
  avgGradePct: number;
  targetSpeedKmh: number;
  predictedTimeS: number;
  cumulativeTimeS: number;
  startCheckpoint: string;
  endCheckpoint: string;
}

function round(value: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

function clampKm(km: number, minKm: number, maxKm: number): number {
  return Math.min(maxKm, Math.max(minKm, km));
}

function normalizeBoundaries(checkpoints: Checkpoint[], totalDistanceKm: number): Array<{ km: number; name: string }> {
  const interior = checkpoints
    .map((cp) => ({ ...cp, km: clampKm(cp.km, 0, totalDistanceKm) }))
    .filter((cp) => cp.km > 0 && cp.km < totalDistanceKm)
    .sort((a, b) => a.km - b.km);

  const deduped: Array<{ km: number; name: string }> = [];
  const epsilon = 1e-6;
  for (const cp of interior) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.km - cp.km) > epsilon) {
      deduped.push({ km: cp.km, name: cp.name });
    }
  }

  return [{ km: 0, name: 'Start' }, ...deduped, { km: totalDistanceKm, name: 'Finish' }];
}

export function buildCustomSegments(
  plannedSegments: PlannedSegment[],
  checkpoints: Checkpoint[],
  totalDistanceKm: number,
): CustomSegmentTarget[] {
  if (plannedSegments.length === 0) {
    return [];
  }

  const boundaries = normalizeBoundaries(checkpoints, totalDistanceKm);
  const output: CustomSegmentTarget[] = [];
  let cumulativeTimeS = 0;

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const startKm = start.km;
    const endKm = end.km;
    if (endKm <= startKm) {
      continue;
    }

    let lengthM = 0;
    let weightedGrade = 0;
    let predictedTimeS = 0;

    for (const segment of plannedSegments) {
      const overlapStartKm = Math.max(startKm, segment.startKm);
      const overlapEndKm = Math.min(endKm, segment.endKm);
      const overlapKm = overlapEndKm - overlapStartKm;
      if (overlapKm <= 0) {
        continue;
      }

      const overlapM = overlapKm * 1000;
      const segmentSpanKm = segment.endKm - segment.startKm;
      const ratio = segmentSpanKm > 0 ? overlapKm / segmentSpanKm : 0;
      lengthM += overlapM;
      weightedGrade += segment.avgGradePct * overlapM;
      predictedTimeS += segment.predictedTimeS * ratio;
    }

    if (lengthM <= 0) {
      continue;
    }

    cumulativeTimeS += predictedTimeS;

    output.push({
      segmentIndex: output.length,
      startKm,
      endKm,
      lengthM,
      avgGradePct: weightedGrade / lengthM,
      targetSpeedKmh: (lengthM / predictedTimeS) * 3.6,
      predictedTimeS,
      cumulativeTimeS,
      startCheckpoint: start.name,
      endCheckpoint: end.name,
    });
  }

  return output;
}

export function customSegmentsToCsv(segments: CustomSegmentTarget[]): string {
  const header = [
    'segment_index',
    'start_checkpoint',
    'end_checkpoint',
    'start_km',
    'end_km',
    'length_m',
    'avg_grade',
    'target_speed_kmh',
    'predicted_time_s',
    'cumulative_time_s',
  ];

  const rows = segments.map((segment) => [
    segment.segmentIndex,
    `"${segment.startCheckpoint.replaceAll('"', '""')}"`,
    `"${segment.endCheckpoint.replaceAll('"', '""')}"`,
    round(segment.startKm, 3),
    round(segment.endKm, 3),
    round(segment.lengthM, 2),
    round(segment.avgGradePct, 3),
    round(segment.targetSpeedKmh, 3),
    round(segment.predictedTimeS, 3),
    round(segment.cumulativeTimeS, 3),
  ]);

  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function customSegmentsToJson(segments: CustomSegmentTarget[]): string {
  return JSON.stringify({ customSegments: segments }, null, 2);
}
