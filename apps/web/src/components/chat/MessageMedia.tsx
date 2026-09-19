import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { FileKind, LinkPreview, StoredFile } from '@teakflow/shared';
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Mic, Paperclip, Pause, Play, X } from 'lucide-react';
import { ChatCodeBlock, parseMessageContent } from '@/components/chat/ChatCodeBlock';
import { isMarkdownFile } from '@/components/chat/MarkdownPreview';
import { Typing } from '@/components/ui/typing';
import { cn } from '@/lib/cn';

function pdfPageImageUrl(url: string, page = 1) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'blob:') {
      return url;
    }
    if (!parsed.hostname.includes('cloudinary.com') || !parsed.pathname.includes('/upload/')) {
      return url;
    }
    parsed.pathname = parsed.pathname.replace('/raw/upload/', '/image/upload/');
    if (/\/pg_\d+/.test(parsed.pathname)) {
      return parsed.toString();
    }
    parsed.pathname = parsed.pathname.replace('/upload/', `/upload/f_jpg,pg_${page},q_auto,w_1600/`);
    return parsed.toString();
  } catch {
    return url;
  }
}

function isBlobUrl(url: string) {
  return url.startsWith('blob:');
}

function downloadUrl(file: StoredFile) {
  try {
    const parsed = new URL(file.url);
    if (!parsed.hostname.includes('cloudinary.com') || !parsed.pathname.includes('/upload/')) {
      return file.url;
    }
    const safeName = encodeURIComponent(file.originalName).replace(/['()*]/g, '');
    return file.url.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
  } catch {
    return file.url;
  }
}

async function downloadFile(file: StoredFile) {
  const namedUrl = downloadUrl(file);
  try {
    const response = await fetch(namedUrl);
    if (!response.ok) {
      throw new Error('Download failed.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.originalName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement('a');
    link.href = namedUrl;
    link.download = file.originalName;
    link.rel = 'noreferrer';
    link.target = '_blank';
    link.click();
  }
}

function DownloadButton({ file, className }: { file: StoredFile; className?: string }) {
  return (
    <button
      type="button"
      className={cn('inline-flex items-center gap-1 text-sm text-sage hover:text-sage-hover', className)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void downloadFile(file);
      }}
    >
      <Download size={14} />
      Download
    </button>
  );
}

function PdfPagePreview({
  url,
  alt,
  className,
  imgClassName,
}: {
  url: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const preview = pdfPageImageUrl(url);

  if (isBlobUrl(url)) {
    return (
      <iframe title={alt} src={url} className={cn('h-full w-full border-0 bg-surface', className)} />
    );
  }

  if (failed) {
    return (
      <span className={cn('flex h-full items-center justify-center text-sm text-muted', className)}>
        PDF preview is not available. Open the file to view it.
      </span>
    );
  }

  return (
    <img
      src={preview}
      alt={alt}
      className={cn('bg-surface', imgClassName)}
      onError={() => setFailed(true)}
    />
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function waveformFrom(seed: string, count = 28) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: count }, (_, index) => {
    const n = Math.abs(Math.sin(hash + index * 12.9898) * 43758.5453);
    return 4 + Math.floor((n % 1) * 16);
  });
}

let activeVoice: HTMLAudioElement | null = null;

export function VoiceNotePlayer({
  file,
  tone = 'received',
}: {
  file: StoredFile;
  tone?: 'sent' | 'received';
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useMemo(() => waveformFrom(file.publicId || file.url), [file.publicId, file.url]);
  const sent = tone === 'sent';

  function toggle() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (playing) {
      audio.pause();
      return;
    }
    if (activeVoice && activeVoice !== audio) {
      activeVoice.pause();
    }
    activeVoice = audio;
    void audio.play();
  }

  function seek(event: MouseEvent<HTMLButtonElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    audio.currentTime = ratio * duration;
    setProgress(ratio);
  }

  const remaining = duration > 0 ? Math.max(0, duration * (1 - progress)) : duration;
  const shown = playing || progress > 0 ? remaining : duration;

  return (
    <div className={cn('flex min-w-[200px] items-center gap-2', sent ? 'text-surface' : 'text-sage')}>
      <button
        type="button"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="inline-flex size-8 shrink-0 items-center justify-center"
        onClick={toggle}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <button
        type="button"
        aria-label="Seek"
        className="flex h-8 flex-1 items-center gap-[2.5px]"
        onClick={seek}
      >
        {bars.map((height, index) => {
          const filled = index / bars.length <= progress;
          return (
            <span
              key={index}
              className={cn(
                'w-[2.5px] rounded-full',
                filled ? 'opacity-100' : 'opacity-35',
                sent ? 'bg-surface' : 'bg-sage',
              )}
              style={{ height }}
            />
          );
        })}
      </button>
      <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums">{formatClock(shown)}</span>
      <audio
        ref={audioRef}
        src={file.url}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (audio.duration) {
            setProgress(audio.currentTime / audio.duration);
            setDuration(audio.duration);
          }
        }}
      />
    </div>
  );
}

function kindIcon(kind: StoredFile['kind']) {
  if (kind === 'image') {
    return ImageIcon;
  }
  if (kind === 'pdf' || kind === 'markdown') {
    return FileText;
  }
  if (kind === 'spreadsheet') {
    return FileSpreadsheet;
  }
  if (kind === 'audio') {
    return Mic;
  }
  return Paperclip;
}

function useFetchedText(url: string | null) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) {
      setText(null);
      setError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    setText(null);

    void fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load markdown');
        }
        return response.text();
      })
      .then((value) => {
        if (!cancelled) {
          setText(value);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { text, error, loading };
}

function MarkdownFileCard({
  file,
  onOpen,
}: {
  file: StoredFile;
  onOpen: (file: StoredFile) => void;
}) {
  const { text, error, loading } = useFetchedText(file.url);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-3 py-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(file)}>
          <span className="block truncate text-sm font-medium text-ink">{file.originalName}</span>
          <span className="block text-xs text-muted">Markdown · {formatBytes(file.bytes)}</span>
        </button>
        <DownloadButton file={file} />
      </div>
      {loading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted">
          <Typing className="h-2 w-5 text-sage" aria-hidden />
          Loading Markdown…
        </p>
      ) : null}
      {error ? (
        <p className="px-3 py-4 text-xs text-muted">Could not load this Markdown file. Open it to view.</p>
      ) : null}
      {text != null ? (
        <div className="px-1.5 pb-1.5 pt-1">
          <ChatCodeBlock code={text} language="md" className="my-0 max-w-none" />
        </div>
      ) : null}
    </div>
  );
}

export type ComposerFile = {
  id: string;
  name: string;
  kind: FileKind;
  previewUrl: string;
  stored: StoredFile | null;
};

export function ComposerFilePreview({
  files,
  link,
  linkLoading,
  onRemove,
  onOpen,
}: {
  files: ComposerFile[];
  link: LinkPreview | null;
  linkLoading?: boolean;
  onRemove: (id: string) => void;
  onOpen: (file: ComposerFile) => void;
}) {
  if (files.length === 0 && !link && !linkLoading) {
    return null;
  }

  const uploading = files.some((file) => !file.stored);

  return (
    <div className="mb-3 space-y-2">
      {uploading ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Typing className="h-2 w-5 text-sage" aria-hidden />
          Uploading {files.filter((file) => !file.stored).length === 1 ? 'file' : 'files'}…
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.map((file) => {
            const Icon = kindIcon(file.kind);
            return (
              <div
                key={file.id}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-line bg-paper"
              >
                <button type="button" className="block h-full w-full" onClick={() => onOpen(file)} disabled={!file.stored}>
                  {file.kind === 'image' ? (
                    <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" />
                  ) : file.kind === 'pdf' && file.stored ? (
                    <PdfPagePreview
                      url={file.stored.url}
                      alt={file.name}
                      className="h-full w-full"
                      imgClassName="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                      <Icon size={18} className="text-sage" />
                      <span className="line-clamp-2 text-[10px] leading-tight text-muted">{file.name}</span>
                    </span>
                  )}
                </button>
                {!file.stored ? (
                  <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface/80">
                    <Typing className="h-2.5 w-7 text-sage" aria-hidden />
                    <span className="text-[10px] font-medium text-ink">Uploading</span>
                  </span>
                ) : null}
                <button
                  type="button"
                  className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-ink/70 text-surface"
                  aria-label={`Remove ${file.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(file.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {linkLoading ? (
        <div className="overflow-hidden rounded-md border border-line bg-paper">
          <div className="flex h-24 items-center justify-center bg-line/50">
            <Typing className="h-3 w-8 text-sage" aria-hidden />
          </div>
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
            <Typing className="h-2 w-5 text-sage" aria-hidden />
            Loading link preview…
          </p>
        </div>
      ) : null}
      {link && !linkLoading ? <LinkPreviewCard preview={link} /> : null}
    </div>
  );
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: StoredFile | null;
  onClose: () => void;
}) {
  const markdownUrl =
    file && (file.kind === 'markdown' || isMarkdownFile(file.originalName, file.contentType))
      ? file.url
      : null;
  const { text: markdownText, error: markdownError, loading: markdownLoading } = useFetchedText(markdownUrl);

  useEffect(() => {
    if (!file) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) {
    return null;
  }

  const isMarkdown = file.kind === 'markdown' || isMarkdownFile(file.originalName, file.contentType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.originalName}</p>
            <p className="text-xs text-muted">{formatBytes(file.bytes)}</p>
          </div>
          <div className="flex items-center gap-3">
            {file.kind !== 'audio' ? (
              <>
                <a href={file.url} target="_blank" rel="noreferrer" className="text-sm text-sage">
                  Open
                </a>
                <DownloadButton file={file} />
              </>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-paper" aria-label="Close preview">
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-paper p-4">
          {file.kind === 'image' ? (
            <img src={file.url} alt={file.originalName} className="mx-auto max-h-[70vh] max-w-full object-contain" />
          ) : null}
          {file.kind === 'pdf' ? (
            <PdfPagePreview
              url={file.url}
              alt={file.originalName}
              className="h-[70vh] w-full rounded-md border border-line bg-surface"
              imgClassName="mx-auto max-h-[70vh] max-w-full object-contain"
            />
          ) : null}
          {file.kind === 'spreadsheet' && file.previewRows?.length ? (
            <div className="overflow-x-auto rounded-md border border-line bg-surface">
              <table className="min-w-full text-left text-xs">
                <tbody>
                  {file.previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-sage-soft/60 font-medium' : 'border-t border-line'}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="whitespace-nowrap px-2 py-1.5">
                          {cell || ' '}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {file.kind === 'spreadsheet' && !file.previewRows?.length ? (
            <p className="text-sm text-muted">Preview is not available. Open the file to view it.</p>
          ) : null}
          {file.kind === 'audio' ? <VoiceNotePlayer file={file} tone="received" /> : null}
          {isMarkdown ? (
            markdownLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Typing className="h-2 w-5 text-sage" aria-hidden />
                Loading Markdown…
              </p>
            ) : markdownError ? (
              <p className="text-sm text-muted">Could not load this Markdown file. Open it to view.</p>
            ) : markdownText != null ? (
              <ChatCodeBlock code={markdownText} language="md" className="my-0 max-w-none" />
            ) : null
          ) : null}
          {file.kind === 'file' && !isMarkdown ? (
            <p className="text-sm text-muted">No inline preview for this file. Open it to download.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block overflow-hidden rounded-md border border-line bg-surface text-left text-ink"
    >
      {preview.image ? (
        <img src={preview.image} alt="" className="h-36 w-full object-cover" />
      ) : null}
      <span className="block space-y-0.5 px-3 py-2">
        <span className="block text-[11px] uppercase tracking-wide text-muted">
          {preview.siteName}
        </span>
        <span className="block text-sm font-medium">{preview.title}</span>
        {preview.description ? (
          <span className="block line-clamp-2 text-xs text-muted">{preview.description}</span>
        ) : null}
      </span>
    </a>
  );
}

export function MessageAttachments({
  attachments,
  onOpen,
  tone = 'received',
  includeAudio = true,
}: {
  attachments: StoredFile[];
  onOpen: (file: StoredFile) => void;
  tone?: 'sent' | 'received';
  includeAudio?: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 space-y-2">
      {attachments.map((file) => {
        if (file.kind === 'audio') {
          if (!includeAudio) {
            return null;
          }
          return (
            <div
              key={file.publicId}
              className={cn(
                'w-fit min-w-[220px] rounded-full px-2.5 py-1.5',
                tone === 'sent' ? 'bg-sage text-surface' : 'bg-sage-soft text-sage',
              )}
            >
              <VoiceNotePlayer file={file} tone={tone} />
            </div>
          );
        }
        if (file.kind === 'image') {
          return (
            <div key={file.publicId} className="overflow-hidden rounded-md border border-line bg-surface">
              <button type="button" className="block w-full" onClick={() => onOpen(file)}>
                <img src={file.url} alt={file.originalName} className="max-h-56 w-full object-cover" />
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-xs text-muted">{file.originalName}</span>
                <DownloadButton file={file} />
              </div>
            </div>
          );
        }
        if (file.kind === 'pdf') {
          return (
            <div key={file.publicId} className="overflow-hidden rounded-md border border-line bg-surface">
              <button type="button" className="block w-full bg-paper" onClick={() => onOpen(file)}>
                <PdfPagePreview
                  url={file.url}
                  alt={file.originalName}
                  className="h-56 w-full"
                  imgClassName="max-h-56 w-full object-contain"
                />
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-xs text-muted">{file.originalName}</span>
                <DownloadButton file={file} />
              </div>
            </div>
          );
        }
        if (file.kind === 'markdown' || isMarkdownFile(file.originalName, file.contentType)) {
          return <MarkdownFileCard key={file.publicId} file={file} onOpen={onOpen} />;
        }
        const Icon = kindIcon(file.kind);
        return (
          <div key={file.publicId} className="flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-ink">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(file)}>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-sage-soft text-sage">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{file.originalName}</span>
                <span className="block text-xs text-muted">
                  {file.kind === 'spreadsheet' ? 'Spreadsheet' : 'File'} · {formatBytes(file.bytes)}
                </span>
              </span>
            </button>
            <DownloadButton file={file} />
          </div>
        );
      })}
    </div>
  );
}

export function MessageText({ text, inverted }: { text: string; inverted?: boolean }) {
  const segments = useMemo(() => parseMessageContent(text), [text]);

  return (
    <span className="block max-w-full whitespace-pre-wrap break-words">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return <ChatCodeBlock key={index} code={segment.value} language={segment.language} />;
        }
        if (segment.type === 'inline') {
          return (
            <code
              key={index}
              className={cn(
                'rounded px-1 py-0.5 font-mono text-[0.85em]',
                inverted ? 'bg-black/15 text-surface' : 'bg-line/70 text-ink',
              )}
            >
              {segment.value}
            </code>
          );
        }
        if (segment.type === 'link') {
          return (
            <a
              key={index}
              href={segment.value}
              target="_blank"
              rel="noreferrer"
              className={cn('break-all underline', inverted ? 'text-surface' : 'text-sage')}
            >
              {segment.value}
            </a>
          );
        }
        return <span key={index}>{segment.value}</span>;
      })}
    </span>
  );
}
