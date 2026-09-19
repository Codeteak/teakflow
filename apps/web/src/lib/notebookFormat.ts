const BULLET = '• ';
export const PAGE_BREAK = '\f';
export const PAGE_LINES = 13;

export function splitNotePages(text: string): string[] {
  if (text.includes(PAGE_BREAK)) {
    const pages = text.split(PAGE_BREAK);
    return pages.length > 0 ? pages : [''];
  }
  const lines = text.split('\n');
  const pages: string[] = [];
  for (let index = 0; index < Math.max(lines.length, 1); index += PAGE_LINES) {
    pages.push(lines.slice(index, index + PAGE_LINES).join('\n'));
  }
  return pages.length > 0 ? pages : [''];
}

export function joinNotePages(pages: string[]): string {
  return pages.join(PAGE_BREAK);
}

export function noteCharacterCount(text: string) {
  return text.replaceAll(PAGE_BREAK, '').trim().length;
}

export type NoteColor = 'sage' | 'amber' | 'rose' | 'muted';

export const NOTE_COLOR_HEX: Record<NoteColor | 'ink', string> = {
  ink: '#1B1A17',
  sage: '#FC4903',
  amber: '#9A6B2F',
  rose: '#A24B3D',
  muted: '#6F6B64',
};

export const NOTE_COLORS: NoteColor[] = ['sage', 'amber', 'rose', 'muted'];

export type InlineToken =
  | { type: 'text' | 'bold' | 'italic' | 'underline'; value: string }
  | { type: 'color'; color: NoteColor; value: string };

type Marker = { open: string; close: string; type: 'bold' | 'italic' | 'underline' };

const MARKERS: Marker[] = [
  { open: '++', close: '++', type: 'underline' },
  { open: '**', close: '**', type: 'bold' },
  { open: '_', close: '_', type: 'italic' },
];

const COLOR_OPEN = /^\{c:(sage|amber|rose|muted)\}/;
const COLOR_CLOSE = '{/c}';
const COLOR_ANY = /\{c:(?:sage|amber|rose|muted)\}|\{\/c\}/g;

export function colorOpen(color: NoteColor) {
  return `{c:${color}}`;
}

export function colorClose() {
  return COLOR_CLOSE;
}

export function hexToNoteColor(hex: string): NoteColor | 'ink' | null {
  const raw = hex.trim().toLowerCase();
  const rgb = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  const compact = rgb
    ? `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
    : raw.startsWith('#')
      ? raw
      : `#${raw}`;
  for (const [name, value] of Object.entries(NOTE_COLOR_HEX) as Array<
    [NoteColor | 'ink', string]
  >) {
    if (value.toLowerCase() === compact) {
      return name;
    }
  }
  return null;
}

function stripColorMarkers(selected: string) {
  return selected.replace(COLOR_ANY, '');
}

function findCloser(text: string, from: number, close: string) {
  let index = from;
  while (index < text.length) {
    const at = text.indexOf(close, index);
    if (at === -1) {
      return -1;
    }
    if (close === '_' && (at === 0 || text[at - 1] === '\\')) {
      index = at + 1;
      continue;
    }
    return at;
  }
  return -1;
}

/**
 * Parse inline markers left-to-right. Nested markers inside a wrap are left in
 * `value` and re-parsed when rendering, so bold+italic round-trips cleanly.
 */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;
  let buffer = '';

  function flush() {
    if (buffer) {
      tokens.push({ type: 'text', value: buffer });
      buffer = '';
    }
  }

  while (index < text.length) {
    let matched = false;

    const colorMatch = text.slice(index).match(COLOR_OPEN);
    if (colorMatch) {
      const color = colorMatch[1] as NoteColor;
      const openLen = colorMatch[0].length;
      const end = text.indexOf(COLOR_CLOSE, index + openLen);
      if (end !== -1) {
        flush();
        tokens.push({ type: 'color', color, value: text.slice(index + openLen, end) });
        index = end + COLOR_CLOSE.length;
        matched = true;
      }
    }

    if (!matched) {
      for (const marker of MARKERS) {
        if (!text.startsWith(marker.open, index)) {
          continue;
        }
        // Italic: only match `_text_` when not inside a word (keeps snake_case plain).
        if (marker.type === 'italic') {
          const prev = index === 0 ? '' : text[index - 1]!;
          if (prev && /[A-Za-z0-9]/.test(prev)) {
            continue;
          }
          const end = text.indexOf('_', index + 1);
          if (end === -1 || end === index + 1) {
            continue;
          }
          const next = text[end + 1] ?? '';
          if (next && /[A-Za-z0-9]/.test(next)) {
            continue;
          }
          const body = text.slice(index + 1, end);
          if (body.includes('_') || body.includes('\n')) {
            continue;
          }
          flush();
          tokens.push({ type: 'italic', value: body });
          index = end + 1;
          matched = true;
          break;
        }
        const end = findCloser(text, index + marker.open.length, marker.close);
        if (end === -1 || end === index + marker.open.length) {
          continue;
        }
        flush();
        tokens.push({
          type: marker.type,
          value: text.slice(index + marker.open.length, end),
        });
        index = end + marker.close.length;
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }
    buffer += text[index];
    index += 1;
  }
  flush();
  return tokens;
}

function stripPairedMarkers(selected: string, before: string, after: string) {
  if (before !== after) {
    return selected.split(before).join('').split(after).join('');
  }
  let out = '';
  let index = 0;
  while (index < selected.length) {
    if (selected.startsWith(before, index)) {
      const end = selected.indexOf(after, index + before.length);
      if (end !== -1) {
        out += selected.slice(index + before.length, end);
        index = end + after.length;
        continue;
      }
    }
    out += selected[index];
    index += 1;
  }
  return out;
}

/**
 * Toggle a wrap around the markdown selection. Expands over adjacent markers so
 * selecting already-bold visible text unwraps instead of nesting.
 */
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
) {
  let from = Math.max(0, Math.min(start, end));
  let to = Math.min(text.length, Math.max(start, end));

  if (
    from >= before.length &&
    text.slice(from - before.length, from) === before &&
    text.slice(to, to + after.length) === after
  ) {
    from -= before.length;
    to += after.length;
  }

  if (from === to) {
    const next = text.slice(0, from) + before + after + text.slice(to);
    return { text: next, caret: from + before.length };
  }

  const selected = text.slice(from, to);
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return {
      text: text.slice(0, from) + inner + text.slice(to),
      caret: from + inner.length,
    };
  }

  const cleaned = stripPairedMarkers(selected, before, after);
  const wrapped = before + cleaned + after;
  return {
    text: text.slice(0, from) + wrapped + text.slice(to),
    caret: from + wrapped.length,
  };
}

/** @deprecated use toggleWrap — kept for any leftover callers */
export function applyWrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
) {
  return toggleWrap(text, start, end, before, after);
}

/** Apply or clear a named text color around the markdown selection. */
export function toggleColor(
  text: string,
  start: number,
  end: number,
  color: NoteColor | 'ink',
) {
  let from = Math.max(0, Math.min(start, end));
  let to = Math.min(text.length, Math.max(start, end));

  const openMatch = text.slice(0, from).match(/\{c:(sage|amber|rose|muted)\}$/);
  if (openMatch && text.startsWith(COLOR_CLOSE, to)) {
    from -= openMatch[0].length;
    to += COLOR_CLOSE.length;
  }

  if (from === to) {
    if (color === 'ink') {
      return { text, caret: from };
    }
    const open = colorOpen(color);
    const next = text.slice(0, from) + open + COLOR_CLOSE + text.slice(to);
    return { text: next, caret: from + open.length };
  }

  const selected = text.slice(from, to);
  const cleaned = stripColorMarkers(selected);
  if (color === 'ink') {
    return {
      text: text.slice(0, from) + cleaned + text.slice(to),
      caret: from + cleaned.length,
    };
  }

  const open = colorOpen(color);
  const wrapped = open + cleaned + COLOR_CLOSE;
  return {
    text: text.slice(0, from) + wrapped + text.slice(to),
    caret: from + wrapped.length,
  };
}

const BLOCK_PREFIX = /^(#{1,2}\s|>\s|•\s|\d+\.\s)/;

export function toggleLinePrefix(text: string, start: number, prefix: string) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = text.indexOf('\n', start);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd);

  if (line.startsWith(prefix)) {
    const next =
      text.slice(0, lineStart) + line.slice(prefix.length) + text.slice(lineEnd);
    return { text: next, caret: Math.max(lineStart, start - prefix.length) };
  }

  const stripped = line.replace(BLOCK_PREFIX, '');
  const next = text.slice(0, lineStart) + prefix + stripped + text.slice(lineEnd);
  const caretInLine = start - lineStart - (line.length - stripped.length);
  return {
    text: next,
    caret: lineStart + prefix.length + Math.max(0, caretInLine),
  };
}

export function continueOrExitList(text: string, caret: number) {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(lineStart, caret);

  if (
    line === '*' ||
    line === '-' ||
    line === '•' ||
    line === BULLET.trimEnd() ||
    line === BULLET ||
    line === '# ' ||
    line === '## ' ||
    line === '> '
  ) {
    return {
      text: text.slice(0, lineStart) + text.slice(caret),
      caret: lineStart,
    };
  }

  if (line.startsWith(BULLET)) {
    return {
      text: `${text.slice(0, caret)}\n${BULLET}${text.slice(caret)}`,
      caret: caret + 1 + BULLET.length,
    };
  }

  const numbered = line.match(/^(\d+)\.\s(.*)$/);
  if (numbered && numbered[2] === '') {
    return {
      text: text.slice(0, lineStart) + text.slice(caret),
      caret: lineStart,
    };
  }
  if (numbered) {
    const nextNumber = Number(numbered[1]) + 1;
    const insert = `\n${nextNumber}. `;
    return {
      text: text.slice(0, caret) + insert + text.slice(caret),
      caret: caret + insert.length,
    };
  }

  return {
    text: `${text.slice(0, caret)}\n${text.slice(caret)}`,
    caret: caret + 1,
  };
}

export function starSpaceToBullet(text: string, caret: number) {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  if (line === '*' || line === '-') {
    const next = text.slice(0, lineStart) + BULLET + text.slice(caret);
    return { text: next, caret: lineStart + BULLET.length };
  }
  return null;
}

export function nextNumberPrefix(text: string, caret: number) {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const previousEnd = lineStart === 0 ? 0 : lineStart - 1;
  const previousStart = text.lastIndexOf('\n', previousEnd - 1) + 1;
  const previous = text.slice(previousStart, previousEnd);
  const match = previous.match(/^(\d+)\.\s/);
  const n = match ? Number(match[1]) + 1 : 1;
  return `${n}. `;
}
