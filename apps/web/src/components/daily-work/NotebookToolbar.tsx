import { useEffect, useRef, useState } from 'react';
import { Bold, Heading, Italic, List, ListOrdered, Palette, TextQuote, Type, Underline } from 'lucide-react';
import type { NotebookEditorApi } from '@/components/daily-work/NotebookEditor';
import { NOTE_COLOR_HEX, NOTE_COLORS, type NoteColor } from '@/lib/notebookFormat';
import { cn } from '@/lib/cn';

type Props = {
  disabled?: boolean;
  getEditor: () => NotebookEditorApi | null;
};

function ToolButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active ? true : undefined}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-line/60 hover:text-ink disabled:opacity-40',
        active && 'bg-sage-soft text-sage hover:bg-sage-soft hover:text-sage',
      )}
    >
      {children}
    </button>
  );
}

export function NotebookToolbar({ disabled, getEditor }: Props) {
  const [marks, setMarks] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: NoteColor | 'ink';
  }>({ bold: false, italic: false, underline: false, color: 'ink' });
  const [colorOpen, setColorOpen] = useState(false);
  const getEditorRef = useRef(getEditor);
  const colorWrapRef = useRef<HTMLDivElement>(null);
  getEditorRef.current = getEditor;

  useEffect(() => {
    function syncMarks() {
      const editor = getEditorRef.current();
      if (!editor) {
        setMarks({ bold: false, italic: false, underline: false, color: 'ink' });
        return;
      }
      setMarks(editor.getActiveMarks());
    }

    syncMarks();
    document.addEventListener('selectionchange', syncMarks);
    return () => document.removeEventListener('selectionchange', syncMarks);
  }, []);

  useEffect(() => {
    if (!colorOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!colorWrapRef.current?.contains(event.target as Node)) {
        setColorOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [colorOpen]);

  function run(action: (editor: NotebookEditorApi) => void) {
    const editor = getEditorRef.current();
    if (!editor) {
      return;
    }
    action(editor);
    setMarks(editor.getActiveMarks());
  }

  function pickColor(color: NoteColor | 'ink') {
    run((editor) => editor.applyColor(color));
    setColorOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <ToolButton label="Heading" disabled={disabled} onClick={() => run((editor) => editor.applyPrefix('# '))}>
        <Heading size={16} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton label="Subheading" disabled={disabled} onClick={() => run((editor) => editor.applyPrefix('## '))}>
        <Type size={16} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton label="Description" disabled={disabled} onClick={() => run((editor) => editor.applyPrefix('> '))}>
        <TextQuote size={16} strokeWidth={1.75} />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolButton
        label="Bold"
        disabled={disabled}
        active={marks.bold}
        onClick={() => run((editor) => editor.applyWrap('**', '**'))}
      >
        <Bold size={16} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        label="Italic"
        disabled={disabled}
        active={marks.italic}
        onClick={() => run((editor) => editor.applyWrap('_', '_'))}
      >
        <Italic size={16} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        label="Underline"
        disabled={disabled}
        active={marks.underline}
        onClick={() => run((editor) => editor.applyWrap('++', '++'))}
      >
        <Underline size={16} strokeWidth={1.75} />
      </ToolButton>
      <div className="relative" ref={colorWrapRef}>
        <ToolButton
          label="Text color"
          disabled={disabled}
          active={marks.color !== 'ink' || colorOpen}
          onClick={() => setColorOpen((open) => !open)}
        >
          <span className="relative inline-flex flex-col items-center">
            <Palette size={16} strokeWidth={1.75} />
            <span
              className="mt-0.5 h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: NOTE_COLOR_HEX[marks.color] }}
            />
          </span>
        </ToolButton>
        {colorOpen ? (
          <div className="absolute top-full left-0 z-20 mt-1 flex items-center gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-sm">
            <button
              type="button"
              title="Default"
              aria-label="Default text color"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickColor('ink')}
              className={cn(
                'h-6 w-6 rounded-md border border-line',
                marks.color === 'ink' && 'ring-2 ring-sage/40',
              )}
              style={{ backgroundColor: NOTE_COLOR_HEX.ink }}
            />
            {NOTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`${color} text color`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickColor(color)}
                className={cn(
                  'h-6 w-6 rounded-md border border-line',
                  marks.color === color && 'ring-2 ring-sage/40',
                )}
                style={{ backgroundColor: NOTE_COLOR_HEX[color] }}
              />
            ))}
          </div>
        ) : null}
      </div>
      <span className="mx-1 h-4 w-px bg-line" />
      <ToolButton label="Bullet list" disabled={disabled} onClick={() => run((editor) => editor.applyList('bullet'))}>
        <List size={16} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        disabled={disabled}
        onClick={() => run((editor) => editor.applyList('number'))}
      >
        <ListOrdered size={16} strokeWidth={1.75} />
      </ToolButton>
    </div>
  );
}
