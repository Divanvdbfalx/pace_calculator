import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlanFromGpx } from '../src/core/pipeline';

describe('integration', () => {
  it('builds a complete plan from example GPX', async () => {
    const gpx = await readFile(resolve('examples/example.gpx'), 'utf8');
    const result = buildPlanFromGpx({
      gpxXml: gpx,
      targetTimeSec: 4 * 3600,
      uphillBias: 0.2,
      splitBias: 0.3,
    });

    expect(result.plan.segments.length).toBeGreaterThan(5);
    expect(result.plan.summary.totalDistanceKm).toBeGreaterThan(50);
    expect(result.csv).toContain('segment_index,start_km,end_km');
    expect(JSON.parse(result.json).segments.length).toBe(result.plan.segments.length);
  });
});
