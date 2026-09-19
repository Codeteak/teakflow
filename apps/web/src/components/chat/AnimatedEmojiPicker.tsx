import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_REACTIONS } from '@teakflow/shared';
import { AnimatedEmoji } from '@/components/chat/AnimatedEmoji';
import {
  loadNotoAnimatedCatalog,
  notoCodepointToEmoji,
  type NotoAnimatedIcon,
} from '@/features/chat/notoEmoji';

const PICKER_WIDTH = 280;
const PICKER_MAX_HEIGHT = 320;
const GAP = 8;

const CATEGORY_TABS = [
  { id: 'all', label: 'All', match: null },
  { id: 'smileys', label: 'Smileys', match: 'Smileys and emotions' },
  { id: 'people', label: 'People', match: 'People' },
  { id: 'animals', label: 'Animals', match: 'Animals and nature' },
  { id: 'food', label: 'Food', match: 'Food and drink' },
  { id: 'activity', label: 'Activity', match: 'Activities and events' },
  { id: 'travel', label: 'Travel', match: 'Travel and places' },
  { id: 'objects', label: 'Objects', match: 'Objects' },
  { id: 'symbols', label: 'Symbols', match: 'Symbols' },
  { id: 'flags', label: 'Flags', match: 'Flags' },
] as const;

type PanelPos = { top: number; left: number; maxHeight: number };

function positionPanel(trigger: DOMRect): PanelPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceAbove = trigger.top - GAP;
  const spaceBelow = vh - trigger.bottom - GAP;
  const openBelow = spaceBelow >= spaceAbove;
  const available = Math.max(openBelow ? spaceBelow : spaceAbove, 120);
  const maxHeight = Math.min(PICKER_MAX_HEIGHT, available);

  let left = trigger.right - PICKER_WIDTH;
  if (left < GAP) {
    left = trigger.left;
  }
  left = Math.min(Math.max(GAP, left), vw - PICKER_WIDTH - GAP);

  const top = openBelow ? trigger.bottom + GAP : Math.max(GAP, trigger.top - GAP - maxHeight);

  return { top, left, maxHeight };
}

export function EmojiPickerShell({
  open,
  onOpenChange,
  onPick,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: 'left' | 'right';
  onPick: (emoji: string) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="relative shrink-0">
      {children}
      {open ? (
        <AnimatedEmojiPicker
          anchorRef={rootRef}
          onClose={() => onOpenChange(false)}
          onPick={(emoji) => {
            onPick(emoji);
            onOpenChange(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function AnimatedEmojiPicker({
  onPick,
  onClose,
  anchorRef,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  anchorRef: { current: HTMLElement | null };
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]['id']>('smileys');
  const [icons, setIcons] = useState<NotoAnimatedIcon[]>([]);
  const [pos, setPos] = useState<PanelPos>({ top: 0, left: 0, maxHeight: PICKER_MAX_HEIGHT });

  useEffect(() => {
    let cancelled = false;
    void loadNotoAnimatedCatalog().then((rows) => {
      if (!cancelled) setIcons(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    function update() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPos(positionPanel(rect));
      }
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef, onClose]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tab = CATEGORY_TABS.find((item) => item.id === category);
    const inCategory = (icon: NotoAnimatedIcon) =>
      !tab?.match || icon.categories.includes(tab.match);

    const filtered = needle
      ? icons.filter(
          (icon) =>
            inCategory(icon) &&
            (icon.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
              icon.name.toLowerCase().includes(needle) ||
              icon.codepoint.includes(needle)),
        )
      : icons.filter(inCategory);

    return filtered.slice(0, category === 'all' && !needle ? 120 : 160);
  }, [category, icons, query]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Emoji"
      className="fixed z-50 flex w-[280px] flex-col overflow-hidden rounded-lg border border-line bg-surface p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
    >
      <div className="mb-1.5 flex shrink-0 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              tab.id === category
                ? 'shrink-0 rounded-md bg-sage-soft px-2 py-1 text-[11px] font-medium text-sage'
                : 'shrink-0 rounded-md px-2 py-1 text-[11px] text-muted hover:bg-line/50 hover:text-ink'
            }
            onClick={() => setCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mb-1.5 flex shrink-0 gap-0.5">
        {DEFAULT_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="rounded-md p-1 hover:bg-line/50"
            onClick={() => onPick(emoji)}
          >
            <AnimatedEmoji emoji={emoji} size={22} />
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search emoji"
        className="mb-2 h-8 w-full shrink-0 rounded-md border border-line bg-paper px-2 text-xs text-ink outline-none"
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-6 gap-0.5">
          {visible.length === 0 ? (
            <p className="col-span-6 px-1 py-3 text-center text-xs text-muted">
              {icons.length === 0 ? 'Loading animated emoji…' : 'No matches.'}
            </p>
          ) : (
            visible.map((icon) => {
              const emoji = notoCodepointToEmoji(icon.codepoint);
              return (
                <button
                  key={icon.codepoint}
                  type="button"
                  title={icon.tags[0] ?? icon.name}
                  className="flex items-center justify-center rounded-md p-1 hover:bg-line/50"
                  onClick={() => onPick(emoji)}
                >
                  <AnimatedEmoji emoji={emoji} size={24} title={icon.tags[0]} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
