import type { PlannedSegment } from '../../core/types';
import { formatDuration } from '../../core/time';

interface SegmentsTableProps {
  segments: PlannedSegment[];
}

function signedSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded === 0) {
    return '0s';
  }
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}${Math.abs(rounded)}s`;
}

export function SegmentsTable({ segments }: SegmentsTableProps) {
  return (
    <div className="panel">
      <h3>Segment Targets</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Start km</th>
              <th>End km</th>
              <th>Len m</th>
              <th>Grade %</th>
              <th>Speed km/h</th>
              <th>Split</th>
              <th>Cumulative</th>
              <th>Ahead/Behind</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.segmentIndex}>
                <td>{segment.segmentIndex}</td>
                <td>{segment.startKm.toFixed(2)}</td>
                <td>{segment.endKm.toFixed(2)}</td>
                <td>{segment.lengthM.toFixed(0)}</td>
                <td>{segment.avgGradePct.toFixed(2)}</td>
                <td>{segment.targetSpeedKmh.toFixed(2)}</td>
                <td>{formatDuration(segment.predictedTimeS)}</td>
                <td>{formatDuration(segment.cumulativeTimeS)}</td>
                <td>{signedSeconds(segment.aheadBehindDeltaS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
