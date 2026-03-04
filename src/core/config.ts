import type { PacingConstraints } from './types';

export const DEFAULT_RESAMPLE_STEP_M = 100;
export const DEFAULT_MIN_SEGMENT_M = 300;

export const DEFAULT_CONSTRAINTS: PacingConstraints = {
  minSpeedKmh: 5,
  maxSpeedKmh: 65,
  steepDescentCapKmh: 50,
  steepDescentGradePct: -4,
  maxDeltaKmhPerSegment: 6,
};
