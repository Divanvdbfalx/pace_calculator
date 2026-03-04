import { describe, expect, it } from 'vitest';
import { haversineDistanceM } from '../src/core/math';

describe('haversineDistanceM', () => {
  it('calculates distance sanity for 1 degree latitude', () => {
    const distance = haversineDistanceM(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(111000);
    expect(distance).toBeLessThan(111400);
  });
});
