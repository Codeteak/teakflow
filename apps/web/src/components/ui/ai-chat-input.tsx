import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Paperclip, Send, SmilePlus } from 'lucide-react';
import { ComposerCodePreview, looksLikePastedCode, wrapPastedCode } from '@/components/chat/ChatCodeBlock';
import { EmojiPickerShell } from '@/components/chat/AnimatedEmojiPicker';
import { VoiceInput } from '@/components/ui/voice-input';
import { cn } from '@/lib/cn';

const PLACEHOLDERS = [
  'Generate website with HextaUI',
  'Create a new project with Next.js',
  'What is the meaning of life?',
  'What is the best way to learn React?',
  'How to cook a delicious meal?',
  'Summarize this article',
];

const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

type AIChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachFiles?: (files: File[]) => Promise<void> | void;
  onVoiceFile?: (file: File) => Promise<void> | void;
  preview?: ReactNode;
  uploading?: boolean;
  canSubmit?: boolean;
  error?: string;
  disabled?: boolean;
};

function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }
  return AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function audioFileName(mime: string) {
  if (mime.includes('mp4')) {
    return 'voice-message.m4a';
  }
  return 'voice-message.webm';
}

export function AIChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onAttachFiles,
  onVoiceFile,
  preview,
  uploading,
  canSubmit,
  error,
  disabled,
}: AIChatInputProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [listening, setListening] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const hasCodePreview = useMemo(() => looksLikePastedCode(value) || value.includes('```'), [value]);
  const tall = value.includes('\n') || hasCodePreview;

  useEffect(() => {
    if (value) {
      return;
    }
    const interval = window.setInterval(() => {
      setShowPlaceholder(false);
      window.setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 160);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [value]);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleFile(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const list = [...files];
    const names = list.map((file) => file.name).join(', ');
    setFileLabel(names);
    if (onAttachFiles) {
      setFileBusy(true);
      try {
        await onAttachFiles(list);
      } finally {
        setFileBusy(false);
      }
    } else {
      const note = `Attached: ${names}`;
      onChange(value.trim() ? `${value.trim()}\n${note}` : note);
    }
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }

  function releaseMic() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  function stopVoice() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    releaseMic();
    setListening(false);
  }

  async function startVoice() {
    setVoiceError('');
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Voice messages are not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickAudioType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        releaseMic();
        setListening(false);
        if (blob.size < 800) {
          setVoiceError('Recording was too short.');
          return;
        }
        const file = new File([blob], audioFileName(type), { type: blob.type || 'audio/webm' });
        void Promise.resolve(onVoiceFile?.(file)).catch((cause: unknown) => {
          setVoiceError(cause instanceof Error ? cause.message : 'Could not send the voice message.');
        });
      };
      recorder.onerror = () => {
        releaseMic();
        setListening(false);
        setVoiceError('Could not record audio. Try again.');
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setListening(true);
    } catch {
      releaseMic();
      setListening(false);
      setVoiceError('Microphone access is needed to send a voice message.');
    }
  }

  function handleSubmit(event: FormEvent) {
    onSubmit(event);
    setFileLabel('');
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData('text');
    if (!pasted || !looksLikePastedCode(pasted)) {
      return;
    }
    event.preventDefault();
    const el = event.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const wrapped = wrapPastedCode(pasted);
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      const cursor = start + wrapped.length;
      el.setSelectionRange(cursor, cursor);
      el.focus();
    });
  }

  return (
    <form
      className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-4"
      onSubmit={handleSubmit}
    >
      <ComposerCodePreview
        value={value}
        onClearCode={() => {
          onChange('');
          fieldRef.current?.focus();
        }}
      />
      {preview}
      <div
        className={cn(
          'mx-auto flex w-full min-w-0 max-w-3xl items-end gap-0.5 border border-line bg-surface pl-1 pr-1',
          tall ? 'rounded-2xl py-1' : 'h-12 items-center rounded-full',
        )}
      >
        <button
          type="button"
          title="Attach file"
          disabled={disabled || fileBusy || uploading}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink md:size-10"
          onClick={(event) => {
            event.stopPropagation();
            fileRef.current?.click();
          }}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.xls,.xlsx,.csv,.md,.markdown,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/markdown,text/x-markdown,audio/*"
          className="hidden"
          onChange={(event) => handleFile(event.target.files)}
        />

        <div className="relative min-w-0 flex-1 py-1">
          <textarea
            ref={fieldRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            className="chat-pill-input relative z-10 max-h-40 w-full min-w-0 resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-2.5 text-sm leading-5 text-ink shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 md:px-2"
          />
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 left-1.5 flex items-center truncate text-sm text-muted md:left-2',
              showPlaceholder && !value ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transition: `opacity 160ms ${ease}` }}
          >
            {PLACEHOLDERS[placeholderIndex]}
          </span>
        </div>

        <EmojiPickerShell
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={(emoji) => {
            onChange(`${value}${emoji}`);
            fieldRef.current?.focus();
          }}
        >
          <button
            type="button"
            title="Emoji"
            disabled={disabled}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink md:size-10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setPickerOpen((open) => !open);
            }}
          >
            <SmilePlus size={18} />
          </button>
        </EmojiPickerShell>

        <VoiceInput
          className="shrink-0"
          listening={listening}
          disabled={disabled}
          onStart={() => void startVoice()}
          onStop={stopVoice}
        />
        <button
          type="submit"
          title="Send"
          disabled={disabled || fileBusy || uploading || !(canSubmit ?? Boolean(value.trim()))}
          className={cn(
            'mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40 md:size-10',
            (canSubmit ?? Boolean(value.trim()))
              ? 'bg-sage text-surface hover:bg-sage-hover'
              : 'bg-ink text-surface hover:bg-ink/90',
          )}
        >
          <Send size={16} />
        </button>
      </div>
      {fileBusy || uploading ? <p className="mx-auto mt-2 max-w-3xl px-2 text-xs text-muted">Uploading…</p> : null}
      {fileLabel && !fileBusy && !uploading ? (
        <p className="mx-auto mt-2 max-w-3xl truncate px-2 text-xs text-muted">File: {fileLabel}</p>
      ) : null}
      {voiceError || error ? (
        <p className="mx-auto mt-2 max-w-3xl px-2 text-sm text-rose">{voiceError || error}</p>
      ) : null}
    </form>
  );
}
