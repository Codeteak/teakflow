export function splitWorkDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year ?? 2026, month: month ?? 1, day: day ?? 1 };
}

export function workDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export type CalendarCell = {
  date: string | null;
  day: number | null;
};

export function monthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayPad = (firstWeekday + 6) % 7;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < mondayPad; i += 1) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push({ date: workDateKey(year, month, day), day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }
  return cells;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
