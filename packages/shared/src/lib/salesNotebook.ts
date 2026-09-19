import { SALES_VISIT_KIND } from '../constants/index';
import type { SalesVisitInput } from '../types/sales';

export function formatVisitBlock(visit: SalesVisitInput, at: Date, timezone: string, sequence = 1) {
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(at);
  const day = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(at);
  const shopName = visit.shopName.trim();
  const shopId = visit.shopId?.trim();
  const place = visit.place.trim();
  const kind =
    visit.kind === SALES_VISIT_KIND.INSTALLATION
      ? 'Installation'
      : visit.kind === SALES_VISIT_KIND.DEMO
        ? 'Demo'
        : 'Store visit';
  const count = visit.count > 1 ? ` × ${visit.count}` : '';
  const meta = [`${day}, ${time}`, place, `${kind}${count}`, shopId ? `ID ${shopId}` : 'Not in directory']
    .filter(Boolean)
    .join('  ·  ');
  const notes = visit.notes.trim();
  return [`# ${sequence}. ${shopName}`, `> ${meta}`, notes || '—', '---'].join('\n');
}

export function composeNotebook(visits: SalesVisitInput[], at: Date, timezone: string) {
  return visits
    .filter((visit) => visit.shopName.trim())
    .map((visit, index) => formatVisitBlock(visit, at, timezone, index + 1))
    .join('\n\n');
}

export function mergeNotebook(existing: string, blocks: string) {
  if (!blocks.trim()) {
    return existing;
  }
  if (!existing.trim()) {
    return blocks.trim();
  }
  if (existing.includes(blocks.trim())) {
    return existing;
  }
  return `${existing.trim()}\n\n${blocks.trim()}`;
}
