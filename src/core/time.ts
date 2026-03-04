export function parseHhMmSs(value: string): number {
  const trimmed = value.trim();
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) {
    throw new Error('Invalid time format. Expected HH:MM:SS');
  }

  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) {
      throw new Error('Invalid time format. Minutes/seconds must be < 60');
    }
    return h * 3600 + m * 60 + s;
  }

  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) {
      throw new Error('Invalid time format. Seconds must be < 60');
    }
    return m * 60 + s;
  }

  throw new Error('Invalid time format. Expected HH:MM:SS');
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
