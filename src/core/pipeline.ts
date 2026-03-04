import { DEFAULT_CONSTRAINTS, DEFAULT_MIN_SEGMENT_M, DEFAULT_RESAMPLE_STEP_M } from './config';
import { planToCsv, planToJson } from './export';
import { parseGpx } from './gpx';
import { generatePacingPlan } from './plan';
import { resampleByDistance } from './resample';
import { segmentCourse } from './segment';
import type { CourseSegment, PacingInputs, PlanResult, RiderLevel, RoutePoint } from './types';

export interface BuildPlanOptions {
  gpxXml: string;
  targetTimeSec?: number;
  targetAvgSpeedKmh?: number;
  uphillBias: number;
  splitBias: number;
  riderLevel?: RiderLevel;
  resampleStepM?: number;
  minSegmentM?: number;
  constraints?: Partial<PacingInputs['constraints']>;
}

export interface BuildPlanResult {
  plan: PlanResult;
  csv: string;
  json: string;
  resampledPoints: RoutePoint[];
}

export interface PreparedCourse {
  resampledPoints: RoutePoint[];
  segments: CourseSegment[];
}

export interface BuildPlanFromPreparedCourseOptions {
  preparedCourse: PreparedCourse;
  targetTimeSec?: number;
  targetAvgSpeedKmh?: number;
  uphillBias: number;
  splitBias: number;
  riderLevel?: RiderLevel;
  constraints?: Partial<PacingInputs['constraints']>;
}

export function prepareCourseFromGpx(gpxXml: string, resampleStepM?: number, minSegmentM?: number): PreparedCourse {
  const parsed = parseGpx(gpxXml);
  const resampledPoints = resampleByDistance(parsed.points, resampleStepM ?? DEFAULT_RESAMPLE_STEP_M);
  const segments = segmentCourse(resampledPoints, minSegmentM ?? DEFAULT_MIN_SEGMENT_M);

  return { resampledPoints, segments };
}

export function buildPlanFromPreparedCourse(options: BuildPlanFromPreparedCourseOptions): BuildPlanResult {
  const { preparedCourse } = options;

  const plan = generatePacingPlan(preparedCourse.segments, {
    targetTimeSec: options.targetTimeSec,
    targetAvgSpeedKmh: options.targetAvgSpeedKmh,
    uphillBias: options.uphillBias,
    splitBias: options.splitBias,
    riderLevel: options.riderLevel,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      ...(options.constraints ?? {}),
    },
  });

  return {
    plan,
    csv: planToCsv(plan),
    json: planToJson(plan),
    resampledPoints: preparedCourse.resampledPoints,
  };
}

export function buildPlanFromGpx(options: BuildPlanOptions): BuildPlanResult {
  const preparedCourse = prepareCourseFromGpx(options.gpxXml, options.resampleStepM, options.minSegmentM);

  return buildPlanFromPreparedCourse({
    preparedCourse,
    targetTimeSec: options.targetTimeSec,
    targetAvgSpeedKmh: options.targetAvgSpeedKmh,
    uphillBias: options.uphillBias,
    splitBias: options.splitBias,
    riderLevel: options.riderLevel,
    constraints: options.constraints,
  });
}
