import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS } from '../src/core/config';
import { generatePacingPlan } from '../src/core/plan';
import type { CourseSegment, PacingInputs } from '../src/core/types';

const segments: CourseSegment[] = [
  {
    segmentIndex: 0,
    startKm: 0,
    endKm: 2,
    lengthM: 2000,
    avgGradePct: 3,
    elevationGainM: 60,
    elevationLossM: 0,
  },
  {
    segmentIndex: 1,
    startKm: 2,
    endKm: 5,
    lengthM: 3000,
    avgGradePct: 0.5,
    elevationGainM: 15,
    elevationLossM: 0,
  },
  {
    segmentIndex: 2,
    startKm: 5,
    endKm: 8,
    lengthM: 3000,
    avgGradePct: -5,
    elevationGainM: 0,
    elevationLossM: 150,
  },
  {
    segmentIndex: 3,
    startKm: 8,
    endKm: 10,
    lengthM: 2000,
    avgGradePct: 1.5,
    elevationGainM: 30,
    elevationLossM: 0,
  },
];

function buildInputs(uphillBias: number, splitBias: number): PacingInputs {
  return {
    targetTimeSec: 1400,
    uphillBias,
    splitBias,
    constraints: { ...DEFAULT_CONSTRAINTS },
  };
}

describe('generatePacingPlan', () => {
  it('matches target time within 2 seconds for multiple bias combinations', () => {
    const biasPairs = [
      [-1, -1],
      [0, 0],
      [1, 1],
      [0.5, -0.3],
    ] as const;

    for (const [uphillBias, splitBias] of biasPairs) {
      const result = generatePacingPlan(segments, buildInputs(uphillBias, splitBias));
      expect(Math.abs(result.summary.finishDeltaS)).toBeLessThanOrEqual(2);
    }
  });

  it('respects hard speed constraints', () => {
    const result = generatePacingPlan(segments, buildInputs(1, 1));

    for (const segment of result.segments) {
      expect(segment.targetSpeedKmh).toBeGreaterThanOrEqual(DEFAULT_CONSTRAINTS.minSpeedKmh - 1e-8);
      if (segment.avgGradePct < DEFAULT_CONSTRAINTS.steepDescentGradePct) {
        expect(segment.targetSpeedKmh).toBeLessThanOrEqual(DEFAULT_CONSTRAINTS.steepDescentCapKmh + 1e-8);
      } else {
        expect(segment.targetSpeedKmh).toBeLessThanOrEqual(DEFAULT_CONSTRAINTS.maxSpeedKmh + 1e-8);
      }
    }
  });

  it('enforces adjacent smoothing bound when enabled', () => {
    const result = generatePacingPlan(segments, buildInputs(-0.8, 0.8));

    for (let i = 1; i < result.segments.length; i += 1) {
      const delta = Math.abs(result.segments[i].targetSpeedKmh - result.segments[i - 1].targetSpeedKmh);
      expect(delta).toBeLessThanOrEqual((DEFAULT_CONSTRAINTS.maxDeltaKmhPerSegment ?? Infinity) + 1e-8);
    }
  });
});
