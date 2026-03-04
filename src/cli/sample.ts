import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPlanFromGpx } from '../core/pipeline';
import { parseHhMmSs } from '../core/time';

function parseArgs(argv: string[]): {
  gpxPath: string;
  targetTimeSec: number;
  uphillBias: number;
  splitBias: number;
} {
  const defaults = {
    gpxPath: 'examples/example.gpx',
    targetTimeSec: parseHhMmSs('04:00:00'),
    uphillBias: 0,
    splitBias: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!next) {
      continue;
    }

    if (arg === '--gpx') {
      defaults.gpxPath = next;
      i += 1;
    } else if (arg === '--target-time') {
      defaults.targetTimeSec = parseHhMmSs(next);
      i += 1;
    } else if (arg === '--uphill-bias') {
      defaults.uphillBias = Number(next);
      i += 1;
    } else if (arg === '--split') {
      defaults.splitBias = Number(next);
      i += 1;
    }
  }

  return defaults;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const gpxPath = resolve(args.gpxPath);
  const gpxXml = await readFile(gpxPath, 'utf8');

  const result = buildPlanFromGpx({
    gpxXml,
    targetTimeSec: args.targetTimeSec,
    uphillBias: args.uphillBias,
    splitBias: args.splitBias,
  });

  const outDir = resolve('out');
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'plan.csv'), result.csv, 'utf8');
  await writeFile(resolve(outDir, 'plan.json'), result.json, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Plan generated with ${result.plan.segments.length} segments.`);
  // eslint-disable-next-line no-console
  console.log(`Predicted finish: ${result.plan.summary.predictedFinishTimeS.toFixed(2)}s`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
