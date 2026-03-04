import { formatDuration } from '../../core/time';
import type { CustomSegmentTarget } from '../../core/customSegments';

interface CustomSegmentsTableProps {
  segments: CustomSegmentTarget[];
}

export function CustomSegmentsTable({ segments }: CustomSegmentsTableProps) {
  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="panel">
      <h3>Custom Checkpoint Segments</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>From</th>
              <th>To</th>
              <th>Start km</th>
              <th>End km</th>
              <th>Len m</th>
              <th>Grade %</th>
              <th>Speed km/h</th>
              <th>Split</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.segmentIndex}>
                <td>{segment.segmentIndex}</td>
                <td>{segment.startCheckpoint}</td>
                <td>{segment.endCheckpoint}</td>
                <td>{segment.startKm.toFixed(2)}</td>
                <td>{segment.endKm.toFixed(2)}</td>
                <td>{segment.lengthM.toFixed(0)}</td>
                <td>{segment.avgGradePct.toFixed(2)}</td>
                <td>{segment.targetSpeedKmh.toFixed(2)}</td>
                <td>{formatDuration(segment.predictedTimeS)}</td>
                <td>{formatDuration(segment.cumulativeTimeS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
