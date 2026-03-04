import { PACE_TABLE_GRADIENTS, RIDER_LEVEL_PROFILES, buildGradientPaceTable } from '../../core/riderLevels';
import type { RiderLevel } from '../../core/types';

interface GradientPaceTableProps {
  selectedLevel: RiderLevel;
}

export function GradientPaceTable({ selectedLevel }: GradientPaceTableProps) {
  const rows = buildGradientPaceTable();

  return (
    <section className="panel">
      <h3>Estimated Speed by Gradient and Rider Level</h3>
      <p className="hint-text">
        Physics-modeled estimates (steady-state, no drafting). Selected level: {RIDER_LEVEL_PROFILES[selectedLevel].label}.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Level</th>
              {PACE_TABLE_GRADIENTS.map((gradient) => (
                <th key={gradient}>{gradient}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.level} className={row.level === selectedLevel ? 'selected-row' : ''}>
                <td>{row.label}</td>
                {row.speedsByGradient.map((entry) => (
                  <td key={entry.gradientPct}>{entry.minKmh.toFixed(1)}-{entry.maxKmh.toFixed(1)} km/h</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
