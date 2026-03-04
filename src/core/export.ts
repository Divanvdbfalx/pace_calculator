import type { PlanResult } from './types';

function round(value: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

export function planToCsv(plan: PlanResult): string {
  const header = [
    'segment_index',
    'start_km',
    'end_km',
    'length_m',
    'avg_grade',
    'target_speed_kmh',
    'predicted_time_s',
    'cumulative_time_s',
  ];

  const rows = plan.segments.map((segment) => [
    segment.segmentIndex,
    round(segment.startKm, 3),
    round(segment.endKm, 3),
    round(segment.lengthM, 2),
    round(segment.avgGradePct, 3),
    round(segment.targetSpeedKmh, 3),
    round(segment.predictedTimeS, 3),
    round(segment.cumulativeTimeS, 3),
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function planToJson(plan: PlanResult): string {
  return JSON.stringify(
    {
      summary: plan.summary,
      warning: plan.warning,
      segments: plan.segments,
    },
    null,
    2,
  );
}
