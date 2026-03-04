import { XMLParser } from 'fast-xml-parser';
import { haversineDistanceM } from './math';
import type { GpxParseResult, RoutePoint } from './types';

type XmlPoint = {
  lat: string;
  lon: string;
  ele?: number | string;
  time?: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function parseGpx(xml: string): GpxParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const gpx = parsed?.gpx;
  if (!gpx) {
    throw new Error('Invalid GPX: missing gpx root node');
  }

  const tracks = asArray(gpx.trk);
  const points: RoutePoint[] = [];

  for (const trk of tracks) {
    for (const seg of asArray(trk?.trkseg)) {
      for (const pt of asArray<XmlPoint>(seg?.trkpt)) {
        if (pt?.lat === undefined || pt?.lon === undefined) {
          continue;
        }
        const lat = Number(pt.lat);
        const lon = Number(pt.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }
        const eleM = pt.ele !== undefined ? Number(pt.ele) : undefined;
        points.push({
          lat,
          lon,
          eleM: Number.isFinite(eleM ?? NaN) ? eleM : undefined,
          timeIso: typeof pt.time === 'string' ? pt.time : undefined,
          distM: 0,
        });
      }
    }
  }

  if (points.length < 2) {
    throw new Error('Invalid GPX: need at least two track points');
  }

  let totalDistanceM = 0;
  let totalAscentM = 0;
  let totalDescentM = 0;

  points[0].distM = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const d = haversineDistanceM(prev.lat, prev.lon, curr.lat, curr.lon);
    totalDistanceM += d;
    curr.distM = totalDistanceM;

    if (prev.eleM !== undefined && curr.eleM !== undefined) {
      const delta = curr.eleM - prev.eleM;
      if (delta > 0) {
        totalAscentM += delta;
      } else {
        totalDescentM += -delta;
      }
    }
  }

  return {
    points,
    totalDistanceM,
    totalAscentM,
    totalDescentM,
  };
}
