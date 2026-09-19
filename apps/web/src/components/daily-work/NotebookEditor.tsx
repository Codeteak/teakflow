import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react';
import { useState } from 'react';
import { NotebookPageChrome } from '@/components/daily-work/NotebookPages';
import {
  continueOrExitList,
  hexToNoteColor,
  joinNotePages,
  NOTE_COLOR_HEX,
  PAGE_LINES,
  splitNotePages,
  starSpaceToBullet,
  toggleColor,
  toggleLinePrefix,
  toggleWrap,
  nextNumberPrefix,
  type NoteColor,
} from '@/lib/notebookFormat';
import {
  currentBlock,
  htmlToPage,
  mdCaretInPage,
  mdRangeInPage,
  normalizeEditor,
  pageToHtml,
  placeCaretInPage,
  setBlockKind,
  splitBlockAtCaret,
  type BlockKind,
} from '@/lib/notebookHtml';

function blockClipboard(event: ClipboardEvent<HTMLDivElement>) {
  event.preventDefault();
}

function blockDrop(event: DragEvent<HTMLDivElement>) {
  event.preventDefault();
}

export type NotebookPagesHandle = {
  pages: string[];
  pageIndex: number;
};

export type NotebookEditorApi = {
  applyPrefix: (prefix: string) => void;
  applyWrap: (before: string, after: string) => void;
  applyList: (kind: 'bullet' | 'number') => void;
  applyColor: (color: NoteColor | 'ink') => void;
  getActiveMarks: () => { bold: boolean; italic: boolean; underline: boolean; color: NoteColor | 'ink' };
};

type Props = {
  value: string;
  placeholder: string;
  editorRef: MutableRefObject<NotebookEditorApi | null>;
  pagesRef?: MutableRefObject<NotebookPagesHandle>;
  error?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
};

const PREFIX_KIND: Record<string, BlockKind> = {
  '# ': 'h',
  '## ': 'h2',
  '> ': 'd',
  '• ': 'li',
};

export function NotebookEditor({
  value,
  placeholder,
  editorRef,
  pagesRef,
  error,
  onSubmit,
  onChange,
}: Props) {
  const pages = splitNotePages(value);
  const [pageIndex, setPageIndex] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const writingRef = useRef(false);
  const focusedIndex = useRef(0);
  const safeIndex = Math.min(pageIndex, pages.length - 1);
  const pageText = pages[safeIndex] ?? '';

  if (pagesRef) {
    pagesRef.current = { pages, pageIndex: safeIndex };
  }

  function commit(nextPages: string[]) {
    onChange(joinNotePages(nextPages));
  }

  function patchPage(text: string) {
    const next = [...pages];
    next[safeIndex] = text;
    commit(next);
  }

  function writePage(text: string, caret?: number) {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.innerHTML = pageToHtml(text);
    if (typeof caret === 'number') {
      placeCaretInPage(host, caret);
    }
  }

  function focusFirstLine() {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    normalizeEditor(host);
    const first = host.firstElementChild as HTMLElement | null;
    if (!first) {
      return;
    }
    placeCaretInPage(host, 0);
  }

  function emitFromDom() {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    normalizeEditor(host);
    writingRef.current = true;
    patchPage(htmlToPage(host));
  }

  function applyMarkdown(next: { text: string; caret: number }) {
    writingRef.current = true;
    patchPage(next.text);
    requestAnimationFrame(() => writePage(next.text, next.caret));
  }

  function ensureEditableBlock() {
    const host = hostRef.current;
    if (!host) {
      return null;
    }
    normalizeEditor(host);
    let block = currentBlock(host);
    if (!block) {
      host.innerHTML = pageToHtml('');
      block = host.firstElementChild as HTMLElement | null;
    }
    return block;
  }

  function wrapCommand(before: string) {
    if (before === '**') {
      return 'bold';
    }
    if (before === '_') {
      return 'italic';
    }
    if (before === '++') {
      return 'underline';
    }
    return '';
  }

  editorRef.current = {
    applyPrefix(prefix) {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      host.focus();
      ensureEditableBlock();
      const kind = PREFIX_KIND[prefix];
      const block = currentBlock(host);
      if (kind && block) {
        const already = block.getAttribute('data-kind') === kind;
        setBlockKind(block, already ? 'p' : kind);
        const caret = mdCaretInPage(host);
        const md = htmlToPage(host);
        applyMarkdown({ text: md, caret });
        return;
      }
      const md = htmlToPage(host);
      const caret = mdCaretInPage(host);
      applyMarkdown(toggleLinePrefix(md, caret, prefix));
    },
    applyWrap(before, after) {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      host.focus();
      ensureEditableBlock();
      const selection = window.getSelection();
      const command = wrapCommand(before);

      // Collapsed caret: toggle “type in this style” (Word-style). Do not rewrite
      // the DOM from markdown or the browser loses the pending typing marks.
      if (command && selection && selection.isCollapsed) {
        document.execCommand(command);
        return;
      }

      const md = htmlToPage(host);
      const { start, end } = mdRangeInPage(host);
      applyMarkdown(toggleWrap(md, start, end, before, after));
    },
    applyList(kind) {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      host.focus();
      ensureEditableBlock();
      const block = currentBlock(host);
      if (block) {
        const nextKind: BlockKind = kind === 'bullet' ? 'li' : 'n';
        const already = block.getAttribute('data-kind') === nextKind;
        setBlockKind(block, already ? 'p' : nextKind);
        const caret = mdCaretInPage(host);
        const md = htmlToPage(host);
        applyMarkdown({ text: md, caret });
        return;
      }
      const md = htmlToPage(host);
      const caret = mdCaretInPage(host);
      const token = kind === 'bullet' ? '• ' : nextNumberPrefix(md, caret);
      applyMarkdown(toggleLinePrefix(md, caret, token));
    },
    applyColor(color) {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      host.focus();
      ensureEditableBlock();
      const selection = window.getSelection();
      if (selection && selection.isCollapsed) {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, NOTE_COLOR_HEX[color]);
        return;
      }
      const md = htmlToPage(host);
      const { start, end } = mdRangeInPage(host);
      applyMarkdown(toggleColor(md, start, end, color));
    },
    getActiveMarks() {
      try {
        const fore = document.queryCommandValue('foreColor');
        const fromCommand = fore ? hexToNoteColor(fore) : null;
        let color: NoteColor | 'ink' = fromCommand ?? 'ink';
        if (!fromCommand || fromCommand === 'ink') {
          const selection = window.getSelection();
          const node = selection?.anchorNode;
          const el =
            node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement ?? null;
          const colored = el?.closest('[data-color]') as HTMLElement | null;
          const named = colored?.getAttribute('data-color') as NoteColor | null;
          if (named) {
            color = named;
          }
        }
        return {
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          color,
        };
      } catch {
        return { bold: false, italic: false, underline: false, color: 'ink' as const };
      }
    },
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    if (writingRef.current) {
      writingRef.current = false;
      if (htmlToPage(host) === pageText) {
        return;
      }
    }
    writePage(pageText);
  }, [pageText, safeIndex]);

  useEffect(() => {
    if (focusedIndex.current === safeIndex) {
      return;
    }
    focusedIndex.current = safeIndex;
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.focus({ preventScroll: true });
    placeCaretInPage(host, htmlToPage(host).length);
  }, [safeIndex]);

  return (
    <form id="daily-work-notebook" className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
      <div className="min-h-0 flex-1">
        <NotebookPageChrome
          pageIndex={safeIndex}
          pageCount={pages.length}
          canAdd
          onPrev={() => setPageIndex(safeIndex - 1)}
          onNext={() => setPageIndex(safeIndex + 1)}
          onAdd={() => {
            const next = [...pages, ''];
            commit(next);
            setPageIndex(next.length - 1);
          }}
          renderTrailingPage={(index) => (
            <div
              className="notebook-write notebook-write-rich"
              dangerouslySetInnerHTML={{ __html: pageToHtml(pages[index] ?? '') }}
            />
          )}
        >
          <div
            ref={hostRef}
            className="notebook-write notebook-write-rich"
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Daily work note"
            data-placeholder={placeholder}
            data-empty={pageText.trim().length === 0 ? 'true' : 'false'}
            suppressContentEditableWarning
            spellCheck
            onFocus={() => {
              if (pageText.trim().length === 0) {
                focusFirstLine();
              }
            }}
            onClick={() => {
              if (pageText.trim().length === 0) {
                focusFirstLine();
              }
            }}
            onInput={() => emitFromDom()}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              const host = hostRef.current;
              if (!host) {
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                editorRef.current?.applyWrap('**', '**');
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
                event.preventDefault();
                editorRef.current?.applyWrap('_', '_');
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'u') {
                event.preventDefault();
                editorRef.current?.applyWrap('++', '++');
                return;
              }
              if (event.key === ' ') {
                const md = htmlToPage(host);
                const caret = mdCaretInPage(host);
                const converted = starSpaceToBullet(md, caret);
                if (converted) {
                  event.preventDefault();
                  applyMarkdown(converted);
                }
                return;
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                normalizeEditor(host);
                const mdBefore = htmlToPage(host);
                const lines = mdBefore.split('\n');
                if (lines.length >= PAGE_LINES) {
                  const next = [...pages];
                  next[safeIndex] = mdBefore;
                  if (safeIndex === next.length - 1) {
                    next.push('');
                  }
                  commit(next);
                  setPageIndex(safeIndex + 1);
                  return;
                }

                // Prefer a DOM split so bold/italic/underline tags stay balanced
                // across the new line (markdown string-split was breaking markers).
                if (splitBlockAtCaret(host)) {
                  emitFromDom();
                  return;
                }

                const md = htmlToPage(host);
                const caret = mdCaretInPage(host);
                applyMarkdown(continueOrExitList(md, caret));
              }
            }}
            onPaste={blockClipboard}
            onCut={blockClipboard}
            onDrop={blockDrop}
            onDragOver={blockDrop}
          />
        </NotebookPageChrome>
      </div>
      {error ? <p className="px-5 pb-3 pl-14 text-sm text-rose">{error}</p> : null}
    </form>
  );
}
