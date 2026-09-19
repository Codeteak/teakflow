import { useState, type ReactNode } from 'react';
import { NotebookPageChrome } from '@/components/daily-work/NotebookPages';
import { splitNotePages, tokenizeInline } from '@/lib/notebookFormat';

export function inlineFormat(text: string): ReactNode[] {
  return tokenizeInline(text).map((token, key) => {
    if (token.type === 'color') {
      return (
        <span key={`c-${key}`} className={`notebook-color notebook-color-${token.color}`}>
          {inlineFormat(token.value)}
        </span>
      );
    }
    if (token.type === 'bold') {
      return (
        <strong key={`b-${key}`} className="font-semibold">
          {inlineFormat(token.value)}
        </strong>
      );
    }
    if (token.type === 'italic') {
      return (
        <em key={`i-${key}`} className="italic">
          {inlineFormat(token.value)}
        </em>
      );
    }
    if (token.type === 'underline') {
      return (
        <u key={`u-${key}`} className="underline decoration-sage/70 underline-offset-2">
          {inlineFormat(token.value)}
        </u>
      );
    }
    return <span key={`t-${key}`}>{token.value}</span>;
  });
}

function NotebookNoteBody({ text, compact = false }: { text: string; compact?: boolean }) {
  if (!text.trim()) {
    return <p className={compact ? 'text-sm text-muted' : 'notebook-read text-muted'}>Empty page.</p>;
  }

  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let key = 0;

  function flushBullets() {
    if (bullets.length === 0) {
      return;
    }
    blocks.push(
      <ul key={`ul-${key}`} className="notebook-list">
        {bullets.map((item, index) => (
          <li key={index}>{inlineFormat(item)}</li>
        ))}
      </ul>,
    );
    key += 1;
    bullets = [];
  }

  function flushNumbers() {
    if (numbers.length === 0) {
      return;
    }
    blocks.push(
      <ol key={`ol-${key}`} className="notebook-list notebook-list-numbered">
        {numbers.map((item, index) => (
          <li key={index}>{inlineFormat(item)}</li>
        ))}
      </ol>,
    );
    key += 1;
    numbers = [];
  }

  for (const line of lines) {
    if (line.startsWith('• ')) {
      flushNumbers();
      bullets.push(line.slice(2));
      continue;
    }
    const numbered = line.match(/^\d+\.\s(.*)$/);
    if (numbered) {
      flushBullets();
      numbers.push(numbered[1] ?? '');
      continue;
    }
    flushBullets();
    flushNumbers();
    if (line.trim() === '---') {
      blocks.push(<div key={`hr-${key}`} className="notebook-rule" />);
      key += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h4 key={`h2-${key}`} className="notebook-subheading">
          {inlineFormat(line.slice(3))}
        </h4>,
      );
      key += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h3 key={`h-${key}`} className="notebook-heading">
          {inlineFormat(line.slice(2))}
        </h3>,
      );
      key += 1;
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push(
        <p key={`d-${key}`} className="notebook-description">
          {inlineFormat(line.slice(2))}
        </p>,
      );
      key += 1;
      continue;
    }
    blocks.push(
      <p key={`p-${key}`} className="notebook-read-line">
        {line.length > 0 ? inlineFormat(line) : '\u00a0'}
      </p>,
    );
    key += 1;
  }
  flushBullets();
  flushNumbers();

  return <div className={compact ? 'space-y-1 text-sm leading-6' : 'notebook-read-wrap'}>{blocks}</div>;
}

export function NotebookNote({ text, compact = false }: { text: string; compact?: boolean }) {
  if (compact) {
    return <NotebookNoteBody text={text.replaceAll('\f', '\n')} compact />;
  }

  return <NotebookNotePaged text={text} />;
}

function NotebookNotePaged({ text }: { text: string }) {
  const pages = splitNotePages(text);
  const [pageIndex, setPageIndex] = useState(0);
  const safeIndex = Math.min(pageIndex, pages.length - 1);

  return (
    <NotebookPageChrome
      pageIndex={safeIndex}
      pageCount={pages.length}
      onPrev={() => setPageIndex(safeIndex - 1)}
      onNext={() => setPageIndex(safeIndex + 1)}
      renderTrailingPage={(index) => <NotebookNoteBody text={pages[index] ?? ''} />}
    >
      <NotebookNoteBody text={pages[safeIndex] ?? ''} />
    </NotebookPageChrome>
  );
}
