export type RiderLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export interface PacingConstraints {
  minSpeedKmh: number;
  maxSpeedKmh: number;
  steepDescentCapKmh: number;
  steepDescentGradePct: number;
  maxDeltaKmhPerSegment?: number;
}

export interface PacingInputs {
  targetTimeSec?: number;
  targetAvgSpeedKmh?: number;
  uphillBias: number;
  splitBias: number;
  riderLevel?: RiderLevel;
  constraints: PacingConstraints;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  eleM?: number;
  timeIso?: string;
  distM: number;
}

export interface CourseSegment {
  segmentIndex: number;
  startKm: number;
  endKm: number;
  lengthM: number;
  avgGradePct: number;
  elevationGainM: number;
  elevationLossM: number;
}

export interface PlannedSegment extends CourseSegment {
  targetSpeedKmh: number;
  predictedTimeS: number;
  cumulativeTimeS: number;
  aheadBehindDeltaS: number;
}

export interface PlanSummary {
  totalDistanceKm: number;
  totalAscentM: number;
  totalDescentM: number;
  predictedFinishTimeS: number;
  avgSpeedKmh: number;
  targetFinishTimeS: number;
  finishDeltaS: number;
}

export interface GpxParseResult {
  points: RoutePoint[];
  totalDistanceM: number;
  totalAscentM: number;
  totalDescentM: number;
}

export interface PlanResult {
  segments: PlannedSegment[];
  summary: PlanSummary;
  warning?: string;
}
