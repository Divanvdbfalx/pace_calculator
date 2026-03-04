import type { CourseSegment, RoutePoint } from './types';

type RawSegment = {
  startIdx: number;
  endIdx: number;
  startDistM: number;
  endDistM: number;
  lengthM: number;
  avgGradePct: number;
  elevationGainM: number;
  elevationLossM: number;
  band: 'climb' | 'flat' | 'descent';
};

function gradeBand(gradePct: number): RawSegment['band'] {
  if (gradePct >= 2) {
    return 'climb';
  }
  if (gradePct <= -2) {
    return 'descent';
  }
  return 'flat';
}

function buildRawSegments(points: RoutePoint[]): RawSegment[] {
  const chunks: RawSegment[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const lengthM = b.distM - a.distM;
    if (lengthM <= 0) {
      continue;
    }
    const elevA = a.eleM ?? 0;
    const elevB = b.eleM ?? 0;
    const deltaEle = elevB - elevA;
    const avgGradePct = (deltaEle / lengthM) * 100;
    const band = gradeBand(avgGradePct);

    const last = chunks[chunks.length - 1];
    if (last && last.band === band) {
      const totalLen = last.lengthM + lengthM;
      last.endIdx = i;
      last.endDistM = b.distM;
      last.elevationGainM += Math.max(0, deltaEle);
      last.elevationLossM += Math.max(0, -deltaEle);
      last.avgGradePct = ((last.avgGradePct * last.lengthM) + (avgGradePct * lengthM)) / totalLen;
      last.lengthM = totalLen;
    } else {
      chunks.push({
        startIdx: i - 1,
        endIdx: i,
        startDistM: a.distM,
        endDistM: b.distM,
        lengthM,
        avgGradePct,
        elevationGainM: Math.max(0, deltaEle),
        elevationLossM: Math.max(0, -deltaEle),
        band,
      });
    }
  }

  return chunks;
}

function mergeTwo(left: RawSegment, right: RawSegment): RawSegment {
  const totalLen = left.lengthM + right.lengthM;
  return {
    startIdx: left.startIdx,
    endIdx: right.endIdx,
    startDistM: left.startDistM,
    endDistM: right.endDistM,
    lengthM: totalLen,
    avgGradePct: ((left.avgGradePct * left.lengthM) + (right.avgGradePct * right.lengthM)) / totalLen,
    elevationGainM: left.elevationGainM + right.elevationGainM,
    elevationLossM: left.elevationLossM + right.elevationLossM,
    band: gradeBand(((left.avgGradePct * left.lengthM) + (right.avgGradePct * right.lengthM)) / totalLen),
  };
}

function mergeShortSegments(raw: RawSegment[], minSegmentM: number): RawSegment[] {
  if (raw.length <= 1) {
    return raw;
  }

  const segments = [...raw];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].lengthM >= minSegmentM || segments.length === 1) {
        continue;
      }

      if (i === 0) {
        segments.splice(0, 2, mergeTwo(segments[0], segments[1]));
      } else if (i === segments.length - 1) {
        const merged = mergeTwo(segments[i - 1], segments[i]);
        segments.splice(i - 1, 2, merged);
      } else {
        const leftDelta = Math.abs(segments[i - 1].avgGradePct - segments[i].avgGradePct);
        const rightDelta = Math.abs(segments[i + 1].avgGradePct - segments[i].avgGradePct);

        if (leftDelta <= rightDelta) {
          const merged = mergeTwo(segments[i - 1], segments[i]);
          segments.splice(i - 1, 2, merged);
        } else {
          const merged = mergeTwo(segments[i], segments[i + 1]);
          segments.splice(i, 2, merged);
        }
      }

      changed = true;
      break;
    }
  }

  return segments;
}

export function segmentCourse(points: RoutePoint[], minSegmentM = 300): CourseSegment[] {
  if (points.length < 2) {
    return [];
  }

  const raw = buildRawSegments(points);
  const merged = mergeShortSegments(raw, minSegmentM);

  return merged.map((segment, idx) => ({
    segmentIndex: idx,
    startKm: segment.startDistM / 1000,
    endKm: segment.endDistM / 1000,
    lengthM: segment.lengthM,
    avgGradePct: segment.avgGradePct,
    elevationGainM: segment.elevationGainM,
    elevationLossM: segment.elevationLossM,
  }));
}
