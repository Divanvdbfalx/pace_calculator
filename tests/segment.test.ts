import { describe, expect, it } from 'vitest';
import { segmentCourse } from '../src/core/segment';
import type { RoutePoint } from '../src/core/types';

function pt(distM: number, eleM: number): RoutePoint {
  return {
    lat: 0,
    lon: distM / 100000,
    eleM,
    distM,
  };
}

describe('segmentCourse', () => {
  it('merges short middle segment into nearest grade neighbor', () => {
    const points: RoutePoint[] = [
      pt(0, 0),
      pt(500, 25),
      pt(600, 25),
      pt(1100, 50),
    ];

    const segments = segmentCourse(points, 300);
    expect(segments.length).toBe(1);
    expect(segments[0].lengthM).toBeCloseTo(1100, 6);
    expect(segments[0].avgGradePct).toBeGreaterThan(4);
  });
});
