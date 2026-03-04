import { DEFAULT_CONSTRAINTS } from './config';
import { clamp } from './math';
import { baselineSpeedForLevelKmh } from './riderLevels';
import type { CourseSegment, PacingConstraints, PacingInputs, PlanResult, PlannedSegment, RiderLevel } from './types';

function calculateTotalTimeS(lengthsM: number[], speedsKmh: number[]): number {
  return lengthsM.reduce((sum, lengthM, idx) => {
    const speedMs = Math.max(0.1, speedsKmh[idx] / 3.6);
    return sum + lengthM / speedMs;
  }, 0);
}

function applySmoothing(speeds: number[], maxDeltaKmhPerSegment?: number): number[] {
  if (!maxDeltaKmhPerSegment || maxDeltaKmhPerSegment <= 0 || speeds.length < 2) {
    return speeds;
  }

  const smooth = [...speeds];
  for (let i = 1; i < smooth.length; i += 1) {
    const maxAllowed = smooth[i - 1] + maxDeltaKmhPerSegment;
    const minAllowed = smooth[i - 1] - maxDeltaKmhPerSegment;
    smooth[i] = clamp(smooth[i], minAllowed, maxAllowed);
  }

  for (let i = smooth.length - 2; i >= 0; i -= 1) {
    const maxAllowed = smooth[i + 1] + maxDeltaKmhPerSegment;
    const minAllowed = smooth[i + 1] - maxDeltaKmhPerSegment;
    smooth[i] = clamp(smooth[i], minAllowed, maxAllowed);
  }

  return smooth;
}

function projectSpeedConstraints(
  speeds: number[],
  segments: CourseSegment[],
  constraints: PacingConstraints,
): number[] {
  const constrained = speeds.map((speed, idx) => {
    const segment = segments[idx];
    let maxCap = constraints.maxSpeedKmh;
    if (segment.avgGradePct < constraints.steepDescentGradePct) {
      maxCap = Math.min(maxCap, constraints.steepDescentCapKmh);
    }
    return clamp(speed, constraints.minSpeedKmh, maxCap);
  });

  const smoothed = applySmoothing(constrained, constraints.maxDeltaKmhPerSegment);
  return smoothed.map((speed, idx) => {
    const segment = segments[idx];
    let maxCap = constraints.maxSpeedKmh;
    if (segment.avgGradePct < constraints.steepDescentGradePct) {
      maxCap = Math.min(maxCap, constraints.steepDescentCapKmh);
    }
    return clamp(speed, constraints.minSpeedKmh, maxCap);
  });
}

function resolveTargetTimeSec(inputs: PacingInputs, totalDistanceM: number): number {
  if (inputs.targetTimeSec && inputs.targetTimeSec > 0) {
    return inputs.targetTimeSec;
  }
  if (inputs.targetAvgSpeedKmh && inputs.targetAvgSpeedKmh > 0) {
    const speedMs = inputs.targetAvgSpeedKmh / 3.6;
    return totalDistanceM / speedMs;
  }
  throw new Error('Either targetTimeSec or targetAvgSpeedKmh must be provided');
}

function buildInitialProfile(
  segments: CourseSegment[],
  uphillBias: number,
  splitBias: number,
  riderLevel: RiderLevel,
): number[] {
  const n = segments.length;
  return segments.map((segment, idx) => {
    const base = baselineSpeedForLevelKmh(riderLevel, segment.avgGradePct);
    const gradeFactor = clamp(segment.avgGradePct / 8, -1, 1);
    const uphillMultiplier = 1 + uphillBias * 0.18 * gradeFactor;

    const progress = n <= 1 ? 0 : idx / (n - 1);
    const centeredProgress = (progress - 0.5) * 2;
    const splitMultiplier = 1 + splitBias * 0.16 * centeredProgress;

    return base * uphillMultiplier * splitMultiplier;
  });
}

function optimizeSpeedsToTarget(
  initialSpeeds: number[],
  segments: CourseSegment[],
  constraints: PacingConstraints,
  targetTimeSec: number,
): { speeds: number[]; warning?: string } {
  const lengths = segments.map((s) => s.lengthM);

  const constrainedAtScale = (scale: number) =>
    projectSpeedConstraints(initialSpeeds.map((v) => v * scale), segments, constraints);

  const fastest = constrainedAtScale(1000);
  const slowest = constrainedAtScale(0.0001);
  const minFeasibleTime = calculateTotalTimeS(lengths, fastest);
  const maxFeasibleTime = calculateTotalTimeS(lengths, slowest);

  if (targetTimeSec < minFeasibleTime - 0.1) {
    return {
      speeds: fastest,
      warning: 'Target time is faster than feasible with current speed caps. Returned fastest feasible plan.',
    };
  }

  if (targetTimeSec > maxFeasibleTime + 0.1) {
    return {
      speeds: slowest,
      warning: 'Target time is slower than feasible with current speed floor. Returned slowest feasible plan.',
    };
  }

  let low = 0.0001;
  let high = 1000;
  let bestSpeeds = constrainedAtScale(1);
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const candidate = constrainedAtScale(mid);
    const time = calculateTotalTimeS(lengths, candidate);
    const delta = time - targetTimeSec;

    if (Math.abs(delta) < Math.abs(bestDelta)) {
      bestDelta = delta;
      bestSpeeds = candidate;
    }

    if (Math.abs(delta) <= 1) {
      return { speeds: candidate };
    }

    if (delta > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return { speeds: bestSpeeds };
}

export function generatePacingPlan(segments: CourseSegment[], inputs: PacingInputs): PlanResult {
  if (segments.length === 0) {
    throw new Error('No segments available for planning');
  }

  const normalizedInputs: PacingInputs = {
    ...inputs,
    uphillBias: clamp(inputs.uphillBias, -1, 1),
    splitBias: clamp(inputs.splitBias, -1, 1),
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      ...inputs.constraints,
    },
  };

  const totalDistanceM = segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  const totalAscentM = segments.reduce((sum, segment) => sum + segment.elevationGainM, 0);
  const totalDescentM = segments.reduce((sum, segment) => sum + segment.elevationLossM, 0);
  const targetTimeSec = resolveTargetTimeSec(normalizedInputs, totalDistanceM);

  const riderLevel = normalizedInputs.riderLevel ?? 'intermediate';
  const initial = buildInitialProfile(segments, normalizedInputs.uphillBias, normalizedInputs.splitBias, riderLevel);
  const optimized = optimizeSpeedsToTarget(initial, segments, normalizedInputs.constraints, targetTimeSec);

  const avgTargetSpeedMs = totalDistanceM / targetTimeSec;
  let cumulativeTimeS = 0;
  let cumulativeDistanceM = 0;

  const planned: PlannedSegment[] = segments.map((segment, idx) => {
    const speedKmh = optimized.speeds[idx];
    const speedMs = speedKmh / 3.6;
    const predictedTimeS = segment.lengthM / speedMs;
    cumulativeTimeS += predictedTimeS;
    cumulativeDistanceM += segment.lengthM;

    const referenceTimeS = cumulativeDistanceM / avgTargetSpeedMs;
    const aheadBehindDeltaS = cumulativeTimeS - referenceTimeS;

    return {
      ...segment,
      targetSpeedKmh: speedKmh,
      predictedTimeS,
      cumulativeTimeS,
      aheadBehindDeltaS,
    };
  });

  const predictedFinishTimeS = planned[planned.length - 1].cumulativeTimeS;

  return {
    segments: planned,
    summary: {
      totalDistanceKm: totalDistanceM / 1000,
      totalAscentM,
      totalDescentM,
      predictedFinishTimeS,
      avgSpeedKmh: (totalDistanceM / predictedFinishTimeS) * 3.6,
      targetFinishTimeS: targetTimeSec,
      finishDeltaS: predictedFinishTimeS - targetTimeSec,
    },
    warning: optimized.warning,
  };
}
