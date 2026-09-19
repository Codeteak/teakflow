import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const FLIP_SECONDS = 0.58;
// Paper leans into the turn, then settles: it accelerates away from the spine
// and decelerates as the sheet lands.
const PAPER_EASE = [0.42, 0.02, 0.3, 1] as const;
const LIFTED_SHADE = 0.5;
const COVERED_SHADE = 0.3;

type Turn = { id: number; from: number; direction: number };

function LeafFaces({ shade, children }: { shade: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="notebook-face notebook-face-front">
        {children}
        {shade}
      </div>
      <div className="notebook-face notebook-face-back" aria-hidden />
    </>
  );
}

export function NotebookPageChrome({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
  onAdd,
  canAdd,
  renderTrailingPage,
  children,
}: {
  pageIndex: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onAdd?: () => void;
  canAdd?: boolean;
  /** Static copy of the page being turned away from, mounted only during a turn. */
  renderTrailingPage: (index: number) => ReactNode;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [turn, setTurn] = useState<Turn | null>(null);
  const seenIndex = useRef(pageIndex);
  const turnId = useRef(0);

  if (seenIndex.current !== pageIndex) {
    const from = seenIndex.current;
    seenIndex.current = pageIndex;
    turnId.current += 1;
    setTurn({ id: turnId.current, from, direction: pageIndex > from ? 1 : -1 });
  }

  const duration = reduceMotion ? 0 : FLIP_SECONDS;
  // Turning back brings the page we are moving to down over the page we are
  // leaving, so the live sheet swings. Going forward the live sheet already sits
  // flat underneath and the page we are leaving swings off.
  const back = turn !== null && turn.direction < 0;

  function endTurn(id: number) {
    setTurn((current) => (current && current.id === id ? null : current));
  }

  // The sheet is cleared when its swing finishes; the timer is only a backstop so
  // a dropped callback can never leave a half-turned page on screen.
  useEffect(() => {
    if (!turn) {
      return;
    }
    const timer = window.setTimeout(() => endTurn(turn.id), duration * 1000 + 900);
    return () => window.clearTimeout(timer);
  }, [turn, duration]);

  const flip: Transition = { duration, ease: PAPER_EASE };
  const fade: Transition = { duration, ease: 'linear' };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="notebook-page notebook-page-stage relative min-h-0 flex-1 overflow-hidden">
        <div className="notebook-page-stack" aria-hidden />

        {turn ? (
          <>
            <motion.div
              key={turn.id}
              className="notebook-leaf"
              aria-hidden
              style={{ zIndex: back ? 5 : 30, pointerEvents: 'none' }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: back ? 0 : -180 }}
              transition={flip}
              onAnimationComplete={() => {
                if (!back) {
                  endTurn(turn.id);
                }
              }}
            >
              <LeafFaces
                shade={
                  <motion.div
                    className="notebook-leaf-shade"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: back ? COVERED_SHADE : LIFTED_SHADE }}
                    transition={fade}
                  />
                }
              >
                {renderTrailingPage(turn.from)}
              </LeafFaces>
            </motion.div>
            <motion.div
              key={`cast-${turn.id}`}
              className="notebook-cast-shadow"
              style={{ zIndex: back ? 10 : 25 }}
              aria-hidden
              initial={{ opacity: 0, scaleX: 0.04 }}
              animate={{ opacity: [0, 0.42, 0], scaleX: [0.04, 0.9, 1] }}
              transition={fade}
            />
          </>
        ) : null}

        <div
          className={back ? 'notebook-leaf notebook-leaf-fall' : 'notebook-leaf'}
          style={{ zIndex: 20, '--notebook-flip': `${duration}s` } as CSSProperties}
          onAnimationEnd={(event) => {
            if (turn && event.target === event.currentTarget) {
              endTurn(turn.id);
            }
          }}
        >
          <LeafFaces shade={<div className="notebook-leaf-shade" />}>{children}</LeafFaces>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-line/60 hover:text-ink disabled:opacity-30"
          disabled={pageIndex <= 0}
          onClick={onPrev}
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <p className="font-mono text-[11px] text-muted">
          Page {pageIndex + 1} of {pageCount}
        </p>
        {pageIndex < pageCount - 1 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-line/60 hover:text-ink"
            onClick={onNext}
          >
            Next
            <ChevronRight size={14} />
          </button>
        ) : canAdd ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sage hover:bg-sage-soft"
            onClick={() => onAdd?.()}
          >
            New page
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="inline-block w-[4.5rem]" />
        )}
      </div>
    </div>
  );
}
