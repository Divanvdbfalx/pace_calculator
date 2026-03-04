import type { RiderLevel } from './types';

export interface RiderLevelProfile {
  label: string;
  minWkg: number;
  maxWkg: number;
}

const GRAVITY = 9.80665;
const AIR_DENSITY = 1.226;
const C_RR = 0.005;
const DRIVETRAIN_EFFICIENCY = 0.975;
const RIDER_MASS_KG = 75;
const BIKE_MASS_KG = 8;
const SYSTEM_MASS_KG = RIDER_MASS_KG + BIKE_MASS_KG;
const CDA = 0.32;
const GLOBAL_SPEED_FACTOR = 0.8;

export const RIDER_LEVEL_PROFILES: Record<RiderLevel, RiderLevelProfile> = {
  beginner: { label: 'Beginner', minWkg: 2.3, maxWkg: 2.8 },
  intermediate: { label: 'Intermediate', minWkg: 2.9, maxWkg: 3.8 },
  advanced: { label: 'Advanced', minWkg: 3.9, maxWkg: 5.0 },
  pro: { label: 'Pro', minWkg: 5.4, maxWkg: 6.2 },
};

export const PACE_TABLE_GRADIENTS = [0, 2, 4, 6, 8] as const;

export function modeledSpeedKmhAtWkg(gradePct: number, wkg: number): number {
  const wheelPowerW = wkg * RIDER_MASS_KG * DRIVETRAIN_EFFICIENCY;
  const grade = gradePct / 100;

  const a = 0.5 * AIR_DENSITY * CDA;
  const b = SYSTEM_MASS_KG * GRAVITY * (grade + C_RR);

  const f = (vMs: number) => (a * vMs ** 3) + (b * vMs) - wheelPowerW;

  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return ((lo + hi) / 2) * 3.6;
}

export function representativeWkg(level: RiderLevel): number {
  const profile = RIDER_LEVEL_PROFILES[level];
  return (profile.minWkg + profile.maxWkg) / 2;
}

export function baselineSpeedForLevelKmh(level: RiderLevel, gradePct: number): number {
  const wkg = representativeWkg(level);
  const cappedGrade = Math.max(-3, Math.min(10, gradePct));
  return modeledSpeedKmhAtWkg(cappedGrade, wkg) * GLOBAL_SPEED_FACTOR;
}

export function buildGradientPaceTable(): Array<{
  level: RiderLevel;
  label: string;
  speedsByGradient: Array<{ gradientPct: number; minKmh: number; maxKmh: number }>;
}> {
  return (Object.keys(RIDER_LEVEL_PROFILES) as RiderLevel[]).map((level) => {
    const profile = RIDER_LEVEL_PROFILES[level];

    return {
      level,
      label: profile.label,
      speedsByGradient: PACE_TABLE_GRADIENTS.map((gradientPct) => ({
        gradientPct,
        minKmh: modeledSpeedKmhAtWkg(gradientPct, profile.minWkg) * GLOBAL_SPEED_FACTOR,
        maxKmh: modeledSpeedKmhAtWkg(gradientPct, profile.maxWkg) * GLOBAL_SPEED_FACTOR,
      })),
    };
  });
}
