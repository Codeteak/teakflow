import { useMemo } from 'react';
import { marked } from 'marked';
import { cn } from '@/lib/cn';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function sanitizeMarkdownHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function renderMarkdownHtml(source: string) {
  const parsed = marked.parse(source, { async: false }) as string;
  return sanitizeMarkdownHtml(parsed);
}

export function isMarkdownLanguage(language: string) {
  const key = language.trim().toLowerCase();
  return key === 'md' || key === 'markdown';
}

export function isMarkdownFile(name: string, contentType = '') {
  const lower = name.toLowerCase();
  const mime = contentType.toLowerCase();
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    mime === 'text/markdown' ||
    mime === 'text/x-markdown'
  );
}

export function looksLikeMarkdownDocument(text: string) {
  const trimmed = text.trim();
  if (!trimmed.includes('\n') || trimmed.includes('```')) return false;
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 3) return false;
  const signals = lines.filter((line) =>
    /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\[.+\]\(.+\)|---$|\*\*[^*]+\*\*)/.test(line.trim()),
  ).length;
  return signals >= 2;
}

export function MarkdownPreview({
  source,
  className,
  dark,
}: {
  source: string;
  className?: string;
  dark?: boolean;
}) {
  const html = useMemo(() => renderMarkdownHtml(source || ' '), [source]);

  return (
    <div
      className={cn(
        'chat-md-preview max-w-none px-3 py-3 text-sm leading-relaxed',
        dark ? 'chat-md-preview-dark text-[#F4F1EB]' : 'text-ink',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
