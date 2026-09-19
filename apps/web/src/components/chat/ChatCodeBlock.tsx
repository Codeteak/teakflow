import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Expand, ChevronsDownUp, ChevronsUpDown, X } from 'lucide-react';
import {
  codeLanguageIcon,
  codeLanguageLabel,
  detectCodeLanguage,
  fenceLanguageForPaste,
  highlightCode,
  isEnvCode,
} from '@/features/chat/codeHighlight';
import {
  isMarkdownLanguage,
  looksLikeMarkdownDocument,
  MarkdownPreview,
} from '@/components/chat/MarkdownPreview';
import { cn } from '@/lib/cn';

const COLLAPSED_LINES = 12;

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'code'; language: string; value: string };

const FENCE_RE = /```([\w+-]*)[ \t]*\r?\n?([\s\S]*?)```/g;
const INLINE_RE = /`([^`\n]+)`/g;
const LINK_RE = /(https?:\/\/[^\s]+)/g;

function pushTextWithLinks(segments: MessageSegment[], text: string) {
  if (!text) return;
  const parts = text.split(LINK_RE);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('http://') || part.startsWith('https://')) {
      segments.push({ type: 'link', value: part });
    } else {
      let last = 0;
      INLINE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = INLINE_RE.exec(part)) !== null) {
        if (match.index > last) {
          segments.push({ type: 'text', value: part.slice(last, match.index) });
        }
        segments.push({ type: 'inline', value: match[1]! });
        last = match.index + match[0].length;
      }
      if (last < part.length) {
        segments.push({ type: 'text', value: part.slice(last) });
      }
    }
  }
}

function looksLikeBareCode(text: string) {
  const trimmed = text.trim();
  if (!trimmed.includes('\n') || trimmed.includes('```')) return false;
  if (isEnvCode(trimmed)) return true;
  if (looksLikeMarkdownDocument(trimmed)) return true;
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 3) return false;
  const hint =
    /^(import |export |function |const |let |var |class |interface |type |def |async |package |using |#include|<\?php|SELECT |FROM |CREATE |public |private |return )/m;
  const braces = (trimmed.match(/[{};]/g) ?? []).length;
  return hint.test(trimmed) || (braces >= 4 && lines.length >= 4);
}

export function looksLikePastedCode(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes('```')) return true;
  if (isEnvCode(trimmed)) return true;
  if (looksLikeMarkdownDocument(trimmed)) return true;
  if (looksLikeBareCode(trimmed)) return true;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) return false;
  return /[{};]|=>|function |import |export |class |const |let |var |def |return |<\/?[a-zA-Z]/.test(
    trimmed,
  );
}

export function wrapPastedCode(text: string) {
  const trimmed = text.replace(/\s+$/, '');
  if (trimmed.includes('```')) return trimmed;
  const lang = fenceLanguageForPaste(trimmed);
  return lang ? `\`\`\`${lang}\n${trimmed}\n\`\`\`` : `\`\`\`\n${trimmed}\n\`\`\``;
}

export function getComposerCodeBlocks(text: string) {
  return parseMessageContent(text).filter(
    (segment): segment is Extract<MessageSegment, { type: 'code' }> =>
      segment.type === 'code',
  );
}

export function ComposerCodePreview({
  value,
  onClearCode,
}: {
  value: string;
  onClearCode?: () => void;
}) {
  const blocks = useMemo(() => getComposerCodeBlocks(value), [value]);
  if (blocks.length === 0) return null;

  const allMarkdown = blocks.every((block) => isMarkdownLanguage(block.language));

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {allMarkdown ? 'Markdown preview' : 'Code preview'}
        </p>
        {onClearCode ? (
          <button
            type="button"
            className="text-xs text-muted hover:text-ink"
            onClick={onClearCode}
          >
            Clear {allMarkdown ? 'markdown' : 'code'}
          </button>
        ) : null}
      </div>
      {blocks.map((block, index) => (
        <ChatCodeBlock
          key={`${block.language}-${index}`}
          code={block.value}
          language={block.language}
        />
      ))}
    </div>
  );
}

export function parseMessageContent(text: string): MessageSegment[] {
  if (looksLikeBareCode(text)) {
    const value = text.replace(/\n$/, '');
    return [{ type: 'code', language: detectCodeLanguage(value), value }];
  }

  const segments: MessageSegment[] = [];
  let last = 0;
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(text)) !== null) {
    if (match.index > last) {
      pushTextWithLinks(segments, text.slice(last, match.index));
    }
    const value = (match[2] || '').replace(/\n$/, '');
    const hinted = (match[1] || '').trim();
    segments.push({
      type: 'code',
      language: hinted || detectCodeLanguage(value),
      value,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    pushTextWithLinks(segments, text.slice(last));
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

function CodeBody({
  code,
  language,
  maxLines,
  dark,
}: {
  code: string;
  language: string;
  maxLines?: number;
  dark?: boolean;
}) {
  const source = useMemo(() => {
    const normalized = code.replace(/\r\n/g, '\n');
    if (typeof maxLines !== 'number') return normalized;
    const parts = normalized.split('\n');
    if (parts.length <= maxLines) return normalized;
    return parts.slice(0, maxLines).join('\n');
  }, [code, maxLines]);

  const highlighted = useMemo(() => highlightCode(source, language), [source, language]);
  const lineCount = useMemo(() => source.split('\n').length, [source]);

  return (
    <div className="flex min-w-0">
      <div
        className={cn(
          'sticky left-0 z-[1] shrink-0 select-none border-r text-right font-mono text-[11px] leading-5',
          dark
            ? 'border-white/10 bg-[#1B1A17] text-[#6F6B64]'
            : 'border-line bg-surface text-muted',
        )}
        aria-hidden
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="w-9 pr-2 leading-5 md:w-10">
            {index + 1}
          </div>
        ))}
      </div>
      <pre
        className={cn(
          'm-0 min-w-0 flex-1 overflow-x-auto px-3 font-mono text-[12px] leading-5',
          dark ? 'chat-code-hl-dark' : 'chat-code-hl',
        )}
      >
        <code
          className="block whitespace-pre"
          dangerouslySetInnerHTML={{ __html: highlighted.html || ' ' }}
        />
      </pre>
    </div>
  );
}

type MdViewMode = 'code' | 'preview';

export function ChatCodeBlock({
  code,
  language = '',
  className,
  defaultView = 'preview',
}: {
  code: string;
  language?: string;
  className?: string;
  defaultView?: MdViewMode;
}) {
  const resolvedLanguage = useMemo(
    () => detectCodeLanguage(code, language),
    [code, language],
  );
  const isMarkdown =
    isMarkdownLanguage(language || resolvedLanguage) ||
    isMarkdownLanguage(resolvedLanguage);
  const lines = useMemo(() => code.replace(/\r\n/g, '\n').split('\n'), [code]);
  const long = lines.length > COLLAPSED_LINES;
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<MdViewMode>(isMarkdown ? defaultView : 'code');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const showCode = !isMarkdown || viewMode === 'code';

  return (
    <>
      <div
        className={cn(
          'my-1.5 w-full min-w-[min(100%,16rem)] max-w-md overflow-hidden rounded-md border border-line bg-surface text-ink',
          className,
        )}
      >
        <div className="flex items-center gap-1 border-b border-line bg-paper px-2 py-1.5">
          <LanguageBadge language={language || resolvedLanguage} code={code} />
          {isMarkdown ? (
            <div className="mr-1 inline-flex rounded-md border border-line bg-surface p-0.5">
              <button
                type="button"
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium',
                  viewMode === 'code'
                    ? 'bg-sage-soft text-sage'
                    : 'text-muted hover:text-ink',
                )}
                onClick={() => setViewMode('code')}
              >
                Code
              </button>
              <button
                type="button"
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium',
                  viewMode === 'preview'
                    ? 'bg-sage-soft text-sage'
                    : 'text-muted hover:text-ink',
                )}
                onClick={() => setViewMode('preview')}
              >
                Preview
              </button>
            </div>
          ) : null}
          <ToolbarButton
            label={copied ? 'Copied' : 'Copy'}
            onClick={() => void copyCode()}
          >
            {copied ? (
              <Check size={13} strokeWidth={2} />
            ) : (
              <Copy size={13} strokeWidth={1.75} />
            )}
          </ToolbarButton>
          <ToolbarButton label="Expand" onClick={() => setPreviewOpen(true)}>
            <Expand size={13} strokeWidth={1.75} />
          </ToolbarButton>
          {long && showCode ? (
            <ToolbarButton
              label={expanded ? 'Collapse' : 'Expand lines'}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <ChevronsDownUp size={13} strokeWidth={1.75} />
              ) : (
                <ChevronsUpDown size={13} strokeWidth={1.75} />
              )}
            </ToolbarButton>
          ) : null}
        </div>
        {showCode ? (
          <div className="relative max-h-[min(22rem,50vh)] overflow-auto scrollbar-none">
            <CodeBody
              code={code}
              language={resolvedLanguage}
              maxLines={expanded || !long ? undefined : COLLAPSED_LINES}
            />
            {long && !expanded ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
            ) : null}
          </div>
        ) : (
          <div className="max-h-[min(22rem,50vh)] overflow-auto scrollbar-none">
            <MarkdownPreview source={code} />
          </div>
        )}
        {long && showCode ? (
          <button
            type="button"
            className="flex w-full items-center justify-center border-t border-line bg-paper px-3 py-1.5 text-xs font-medium text-sage hover:bg-sage-soft/60"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Show less' : `Show all ${lines.length} lines`}
          </button>
        ) : null}
      </div>

      {previewOpen
        ? createPortal(
            <CodePreviewModal
              code={code}
              language={resolvedLanguage}
              displayLanguage={language || resolvedLanguage}
              isMarkdown={isMarkdown}
              onClose={() => setPreviewOpen(false)}
              onCopy={() => void copyCode()}
              copied={copied}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function LanguageBadge({
  language,
  code,
  large,
}: {
  language: string;
  code: string;
  large?: boolean;
}) {
  const label = codeLanguageLabel(language, code);
  const icon = codeLanguageIcon(language, code);

  return (
    <span
      className={cn('mr-auto inline-flex min-w-0 items-center gap-1.5', large && 'gap-2')}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          className={cn('shrink-0 object-contain', large ? 'size-5' : 'size-3.5')}
        />
      ) : null}
      <span
        className={cn(
          'truncate tracking-wide text-muted uppercase',
          large ? 'text-sm font-semibold normal-case text-ink' : 'font-mono text-[11px]',
        )}
      >
        {label}
      </span>
    </span>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted hover:bg-line/50 hover:text-ink"
      onClick={onClick}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function CodePreviewModal({
  code,
  language,
  displayLanguage,
  isMarkdown,
  onClose,
  onCopy,
  copied,
}: {
  code: string;
  language: string;
  displayLanguage: string;
  isMarkdown?: boolean;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const lineCount = useMemo(() => code.replace(/\r\n/g, '\n').split('\n').length, [code]);
  const [viewMode, setViewMode] = useState<MdViewMode>(isMarkdown ? 'preview' : 'code');

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/35"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(90dvh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
        <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2.5">
          <div className="mr-auto min-w-0">
            <LanguageBadge language={displayLanguage} code={code} large />
            <p className="mt-0.5 font-mono text-[11px] text-muted">{lineCount} lines</p>
          </div>
          {isMarkdown ? (
            <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
              <button
                type="button"
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium',
                  viewMode === 'code'
                    ? 'bg-sage-soft text-sage'
                    : 'text-muted hover:text-ink',
                )}
                onClick={() => setViewMode('code')}
              >
                Code
              </button>
              <button
                type="button"
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium',
                  viewMode === 'preview'
                    ? 'bg-sage-soft text-sage'
                    : 'text-muted hover:text-ink',
                )}
                onClick={() => setViewMode('preview')}
              >
                Preview
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium hover:bg-line/40"
            onClick={onCopy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-line hover:bg-line/40"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {isMarkdown && viewMode === 'preview' ? (
          <div className="min-h-0 flex-1 overflow-auto bg-surface scrollbar-none">
            <MarkdownPreview source={code} className="px-5 py-4" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto bg-[#1B1A17] scrollbar-none">
            <CodeBody code={code} language={language} dark />
          </div>
        )}
      </div>
    </div>
  );
}
