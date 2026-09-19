import {
  colorClose,
  colorOpen,
  hexToNoteColor,
  tokenizeInline,
  type NoteColor,
} from '@/lib/notebookFormat';

export type BlockKind = 'p' | 'h' | 'h2' | 'd' | 'li' | 'n' | 'hr';

const KIND_CLASS: Record<BlockKind, string> = {
  p: 'notebook-read-line',
  h: 'notebook-heading',
  h2: 'notebook-subheading',
  d: 'notebook-description',
  li: 'notebook-edit-bullet',
  n: 'notebook-edit-number',
  hr: 'notebook-rule',
};

export function classForKind(kind: BlockKind) {
  return KIND_CLASS[kind];
}

export function prefixForKind(kind: BlockKind, number = 1) {
  if (kind === 'h') {
    return '# ';
  }
  if (kind === 'h2') {
    return '## ';
  }
  if (kind === 'd') {
    return '> ';
  }
  if (kind === 'li') {
    return '• ';
  }
  if (kind === 'n') {
    return `${number}. `;
  }
  if (kind === 'hr') {
    return '---';
  }
  return '';
}

export function kindFromPrefix(line: string): { kind: BlockKind; inner: string; number?: number } {
  if (line.trim() === '---') {
    return { kind: 'hr', inner: '' };
  }
  if (line.startsWith('## ')) {
    return { kind: 'h2', inner: line.slice(3) };
  }
  if (line.startsWith('# ')) {
    return { kind: 'h', inner: line.slice(2) };
  }
  if (line.startsWith('> ')) {
    return { kind: 'd', inner: line.slice(2) };
  }
  if (line.startsWith('• ')) {
    return { kind: 'li', inner: line.slice(2) };
  }
  const numbered = line.match(/^(\d+)\.\s(.*)$/);
  if (numbered) {
    return { kind: 'n', inner: numbered[2] ?? '', number: Number(numbered[1]) };
  }
  return { kind: 'p', inner: line };
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function wrapMarker(tag: string): string | null {
  if (tag === 'STRONG' || tag === 'B') {
    return '**';
  }
  if (tag === 'EM' || tag === 'I') {
    return '_';
  }
  if (tag === 'U') {
    return '++';
  }
  return null;
}

function isBoldish(el: HTMLElement) {
  const weight = el.style.fontWeight;
  return weight === 'bold' || weight === '700' || Number(weight) >= 600;
}

function isItalicish(el: HTMLElement) {
  return el.style.fontStyle === 'italic';
}

function isUnderlinish(el: HTMLElement) {
  const deco = `${el.style.textDecoration} ${el.style.textDecorationLine}`;
  return deco.includes('underline');
}

function styleMarkers(el: HTMLElement): { open: string; close: string } | null {
  const openParts: string[] = [];
  const closeParts: string[] = [];
  const named =
    (el.getAttribute('data-color') as NoteColor | null) ??
    hexToNoteColor(el.getAttribute('color') || '') ??
    (el.style.color ? hexToNoteColor(rgbToHex(el.style.color) || el.style.color) : null);
  if (named && named !== 'ink') {
    openParts.push(colorOpen(named));
    closeParts.unshift(colorClose());
  }
  if (isBoldish(el)) {
    openParts.push('**');
    closeParts.unshift('**');
  }
  if (isItalicish(el)) {
    openParts.push('_');
    closeParts.unshift('_');
  }
  if (isUnderlinish(el)) {
    openParts.push('++');
    closeParts.unshift('++');
  }
  if (openParts.length === 0) {
    return null;
  }
  return { open: openParts.join(''), close: closeParts.join('') };
}

function rgbToHex(value: string) {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return value.startsWith('#') ? value : '';
  }
  const toHex = (part: string) => Number(part).toString(16).padStart(2, '0');
  return `#${toHex(match[1]!)}${toHex(match[2]!)}${toHex(match[3]!)}`;
}

/** Recursively render markdown inline markers, including nested bold/italic/underline. */
export function inlineToHtml(text: string): string {
  const html = tokenizeInline(text)
    .map((token) => {
      if (token.type === 'text') {
        return escapeHtml(token.value);
      }
      const inner = token.value.length > 0 ? inlineToHtml(token.value) : '';
      if (token.type === 'color') {
        return `<span data-color="${token.color}" class="notebook-color notebook-color-${token.color}">${inner}</span>`;
      }
      if (token.type === 'bold') {
        return `<strong>${inner}</strong>`;
      }
      if (token.type === 'italic') {
        return `<em>${inner}</em>`;
      }
      return `<u>${inner}</u>`;
    })
    .join('');
  return html.length > 0 ? html : '<br>';
}

export function pageToHtml(page: string) {
  const lines = page.length > 0 ? page.split('\n') : [''];
  return lines
    .map((line) => {
      const { kind, inner } = kindFromPrefix(line);
      if (kind === 'hr') {
        return `<div data-kind="hr" class="notebook-rule"></div>`;
      }
      return `<div data-kind="${kind}" class="${classForKind(kind)}">${inlineToHtml(inner)}</div>`;
    })
    .join('');
}

function inlineHtmlToMd(el: Element) {
  let out = '';

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (tag === 'BR') {
      return;
    }

    const marker = wrapMarker(tag);
    if (marker) {
      out += marker;
      Array.from(element.childNodes).forEach(walk);
      out += marker;
      return;
    }

    if (tag === 'SPAN' || tag === 'FONT') {
      const named =
        (element.getAttribute('data-color') as NoteColor | null) ??
        hexToNoteColor(element.getAttribute('color') || rgbToHex(element.style.color) || element.style.color);
      if (named && named !== 'ink') {
        out += colorOpen(named);
        Array.from(element.childNodes).forEach(walk);
        out += colorClose();
        return;
      }
    }

    // Browsers sometimes emit styled spans instead of semantic tags.
    const styled = styleMarkers(element);
    if (styled) {
      out += styled.open;
      Array.from(element.childNodes).forEach(walk);
      out += styled.close;
      return;
    }
    Array.from(element.childNodes).forEach(walk);
  }

  Array.from(el.childNodes).forEach(walk);
  return out.replace(/\u00a0/g, ' ').replace(/\n/g, '');
}

export function htmlBlockToLine(el: Element, number = 1) {
  const kind = (el.getAttribute('data-kind') as BlockKind | null) ?? 'p';
  if (kind === 'hr') {
    return '---';
  }
  const inner = inlineHtmlToMd(el);
  return `${prefixForKind(kind, number)}${inner}`;
}

function unwrapEmptyInlines(root: HTMLElement) {
  const inlines = Array.from(root.querySelectorAll('strong,b,em,i,u,span'));
  for (const el of inlines) {
    if ((el.textContent ?? '').length === 0 && !el.querySelector('br')) {
      el.remove();
    }
  }
}

export function normalizeEditor(root: HTMLElement) {
  const nodes = Array.from(root.childNodes);
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const wrap = document.createElement('div');
      setBlockKind(wrap, 'p');
      wrap.textContent = node.textContent;
      root.replaceChild(wrap, node);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      const wrap = document.createElement('div');
      setBlockKind(wrap, 'p');
      wrap.innerHTML = '<br>';
      root.replaceChild(wrap, node);
      continue;
    }
    if (el.tagName === 'DIV' || el.tagName === 'P') {
      if (!el.hasAttribute('data-kind')) {
        setBlockKind(el, 'p');
      }
      continue;
    }
    if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
      setBlockKind(el, el.tagName === 'H1' || el.tagName === 'H2' ? 'h' : 'h2');
      continue;
    }
    // Unexpected top-level tags (e.g. bare <strong>) become a paragraph.
    const wrap = document.createElement('div');
    setBlockKind(wrap, 'p');
    wrap.appendChild(el.cloneNode(true));
    root.replaceChild(wrap, node);
  }
  unwrapEmptyInlines(root);
  // Contenteditable often sprouts a second empty block under the caret. Keep a
  // blank page as a single first line so typing stays on the placeholder row.
  const blocks = Array.from(root.children) as HTMLElement[];
  if (blocks.length > 1) {
    const allBlank = blocks.every((block) => !(block.textContent ?? '').replace(/\u00a0/g, ' ').trim());
    if (allBlank) {
      for (let index = 1; index < blocks.length; index += 1) {
        blocks[index]?.remove();
      }
      const first = blocks[0];
      if (first) {
        setBlockKind(first, 'p');
        first.innerHTML = '<br>';
      }
    }
  }
  if (root.children.length === 0) {
    const empty = document.createElement('div');
    setBlockKind(empty, 'p');
    empty.innerHTML = '<br>';
    root.appendChild(empty);
  }
}

export function htmlToPage(root: HTMLElement) {
  const lines: string[] = [];
  let number = 1;
  const blocks = Array.from(root.children);
  if (blocks.length === 0) {
    return '';
  }
  for (const child of blocks) {
    const kind = (child.getAttribute('data-kind') as BlockKind | null) ?? 'p';
    if (kind === 'n') {
      lines.push(htmlBlockToLine(child, number));
      number += 1;
    } else {
      number = 1;
      lines.push(htmlBlockToLine(child));
    }
  }
  if (lines.length === 1 && lines[0] === '') {
    return '';
  }
  return lines.join('\n');
}

export function currentBlock(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return (root.lastElementChild as HTMLElement | null) ?? null;
  }
  const node = selection.anchorNode;
  if (!node || !root.contains(node)) {
    return (root.lastElementChild as HTMLElement | null) ?? null;
  }
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  return element?.closest('[data-kind]') as HTMLElement | null;
}

/**
 * Map a DOM point inside a block to a markdown offset within that block's
 * inline content (markers included). This is what made Enter/bold break before.
 */
function mdOffsetInBlock(block: HTMLElement, targetNode: Node, targetOffset: number) {
  let md = 0;
  let found = false;

  function walk(node: Node): boolean {
    if (found) {
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (node === targetNode) {
        md += Math.min(targetOffset, text.length);
        found = true;
        return true;
      }
      md += text.length;
      return false;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const element = node as HTMLElement;
    if (element.tagName === 'BR') {
      if (node === targetNode) {
        found = true;
        return true;
      }
      return false;
    }

    if (node === targetNode) {
      // Caret on an element: offset is a child index.
      const children = Array.from(element.childNodes);
      for (let index = 0; index < Math.min(targetOffset, children.length); index += 1) {
        walk(children[index]!);
      }
      found = true;
      return true;
    }

    const marker = wrapMarker(element.tagName);
    const styled = marker ? null : styleMarkers(element);
    const open = marker ?? styled?.open ?? null;
    const close = marker ?? styled?.close ?? null;

    if (open) {
      md += open.length;
    }
    for (const child of Array.from(element.childNodes)) {
      if (walk(child)) {
        return true;
      }
    }
    if (close && !found) {
      md += close.length;
    }
    return found;
  }

  for (const child of Array.from(block.childNodes)) {
    if (walk(child)) {
      break;
    }
  }
  return md;
}

function blockIndexAndPrefix(root: HTMLElement, block: HTMLElement) {
  let number = 1;
  let offset = 0;
  for (const child of Array.from(root.children)) {
    const kind = (child.getAttribute('data-kind') as BlockKind | null) ?? 'p';
    const lineNumber = kind === 'n' ? number : 1;
    if (kind === 'n') {
      number += 1;
    } else {
      number = 1;
    }
    const line = htmlBlockToLine(child, lineNumber);
    if (child === block) {
      return {
        offset,
        prefix: prefixForKind(kind, lineNumber),
        line,
        kind,
      };
    }
    offset += line.length + 1;
  }
  return null;
}

export function mdCaretInPage(root: HTMLElement) {
  const selection = window.getSelection();
  const block = currentBlock(root);
  if (!block) {
    return htmlToPage(root).length;
  }
  const meta = blockIndexAndPrefix(root, block);
  if (!meta) {
    return htmlToPage(root).length;
  }
  if (!selection || !selection.anchorNode || !block.contains(selection.anchorNode)) {
    return meta.offset + meta.line.length;
  }
  const inner = mdOffsetInBlock(block, selection.anchorNode, selection.anchorOffset);
  return meta.offset + meta.prefix.length + inner;
}

export function mdRangeInPage(root: HTMLElement): { start: number; end: number } {
  const selection = window.getSelection();
  const block = currentBlock(root);
  if (!selection || selection.rangeCount === 0 || !block) {
    const caret = mdCaretInPage(root);
    return { start: caret, end: caret };
  }

  const anchorBlock =
    (selection.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? (selection.anchorNode as HTMLElement)
      : selection.anchorNode?.parentElement
    )?.closest('[data-kind]') ?? null;
  const focusBlock =
    (selection.focusNode?.nodeType === Node.ELEMENT_NODE
      ? (selection.focusNode as HTMLElement)
      : selection.focusNode?.parentElement
    )?.closest('[data-kind]') ?? null;

  // Multi-block selections fall back to caret — wrap tools act on one line.
  if (!anchorBlock || anchorBlock !== focusBlock || anchorBlock !== block) {
    const caret = mdCaretInPage(root);
    return { start: caret, end: caret };
  }

  const meta = blockIndexAndPrefix(root, block);
  if (!meta || !selection.anchorNode || !selection.focusNode) {
    const caret = mdCaretInPage(root);
    return { start: caret, end: caret };
  }

  const a = meta.prefix.length + mdOffsetInBlock(block, selection.anchorNode, selection.anchorOffset);
  const b = meta.prefix.length + mdOffsetInBlock(block, selection.focusNode, selection.focusOffset);
  const start = meta.offset + Math.min(a, b);
  const end = meta.offset + Math.max(a, b);
  return { start, end };
}

export function placeCaretInPage(root: HTMLElement, mdOffset: number) {
  let remaining = mdOffset;
  let number = 1;
  for (const child of Array.from(root.children)) {
    const kind = (child.getAttribute('data-kind') as BlockKind | null) ?? 'p';
    const lineNumber = kind === 'n' ? number : 1;
    if (kind === 'n') {
      number += 1;
    } else {
      number = 1;
    }
    const line = htmlBlockToLine(child, lineNumber);
    if (remaining <= line.length) {
      const prefix = prefixForKind(kind, lineNumber);
      const innerOffset = Math.max(0, remaining - prefix.length);
      placeCaretAtMdOffset(child, innerOffset);
      return;
    }
    remaining -= line.length + 1;
  }
  const last = root.lastElementChild;
  if (last) {
    placeCaretAtMdOffset(last, inlineHtmlToMd(last).length);
  }
}

function placeCaretAtMdOffset(block: Element, mdOffset: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  let remaining = mdOffset;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (remaining <= text.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        selection!.removeAllRanges();
        selection!.addRange(range);
        return true;
      }
      remaining -= text.length;
      return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    const element = node as HTMLElement;
    if (element.tagName === 'BR') {
      if (remaining <= 0) {
        const range = document.createRange();
        range.setStart(element, 0);
        range.collapse(true);
        selection!.removeAllRanges();
        selection!.addRange(range);
        return true;
      }
      return false;
    }

    const marker = wrapMarker(element.tagName);
    const styled = marker ? null : styleMarkers(element);
    const open = marker ?? styled?.open ?? null;
    const close = marker ?? styled?.close ?? null;
    const closeLen = close ? close.length : 0;

    if (open) {
      if (remaining < open.length) {
        // Caret lands on the opening marker — place at start of first text.
        remaining = 0;
      } else {
        remaining -= open.length;
      }
    }

    for (const child of Array.from(element.childNodes)) {
      if (walk(child)) {
        return true;
      }
    }

    if (closeLen) {
      if (remaining < closeLen) {
        // After inner content, on closing marker — place at end of last text.
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection!.removeAllRanges();
        selection!.addRange(range);
        return true;
      }
      remaining -= closeLen;
    }
    return false;
  }

  for (const child of Array.from(block.childNodes)) {
    if (walk(child)) {
      return;
    }
  }

  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function setBlockKind(block: HTMLElement, kind: BlockKind) {
  block.setAttribute('data-kind', kind);
  block.className = classForKind(kind);
}

function isVisuallyEmpty(block: HTMLElement) {
  const text = (block.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  return text.length === 0;
}

/**
 * Split the current block at the caret in the DOM so inline tags stay balanced.
 * Headings/descriptions continue as plain paragraphs; lists continue as lists;
 * empty list/heading lines exit back to a plain line.
 */
export function splitBlockAtCaret(root: HTMLElement): boolean {
  const selection = window.getSelection();
  const block = currentBlock(root);
  if (!selection || selection.rangeCount === 0 || !block || !root.contains(block)) {
    return false;
  }

  const kind = (block.getAttribute('data-kind') as BlockKind | null) ?? 'p';

  if (isVisuallyEmpty(block) && (kind === 'li' || kind === 'n' || kind === 'h' || kind === 'h2' || kind === 'd')) {
    setBlockKind(block, 'p');
    block.innerHTML = '<br>';
    placeCaretAtMdOffset(block, 0);
    return true;
  }

  const range = selection.getRangeAt(0);
  if (!block.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== block) {
    return false;
  }

  if (!range.collapsed) {
    range.deleteContents();
  }

  const afterRange = document.createRange();
  afterRange.selectNodeContents(block);
  afterRange.setStart(range.endContainer, range.endOffset);
  const after = afterRange.extractContents();

  const next = document.createElement('div');
  const nextKind: BlockKind = kind === 'li' || kind === 'n' ? kind : 'p';
  setBlockKind(next, nextKind);

  if (after.childNodes.length === 0 || ((after.textContent ?? '').length === 0 && !after.querySelector('br'))) {
    next.innerHTML = '<br>';
  } else {
    next.appendChild(after);
  }

  if (isVisuallyEmpty(block)) {
    block.innerHTML = '<br>';
  }
  unwrapEmptyInlines(block);
  unwrapEmptyInlines(next);

  block.after(next);
  placeCaretAtMdOffset(next, 0);
  return true;
}
