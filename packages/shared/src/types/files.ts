export type FileKind = 'image' | 'pdf' | 'spreadsheet' | 'audio' | 'markdown' | 'file';

export type StoredFile = {
  url: string;
  publicId: string;
  bytes: number;
  contentType: string;
  originalName: string;
  kind: FileKind;
  previewRows?: string[][];
};

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
};

export function fileKindFrom(contentType: string, originalName: string): FileKind {
  const mime = contentType.toLowerCase();
  const name = originalName.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return 'image';
  }
  if (mime.startsWith('audio/') || /\.(webm|m4a|mp3|ogg|wav|aac)$/.test(name)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv' ||
    /\.(xlsx|xls|csv)$/.test(name)
  ) {
    return 'spreadsheet';
  }
  if (
    mime === 'text/markdown' ||
    mime === 'text/x-markdown' ||
    /\.(md|markdown)$/.test(name)
  ) {
    return 'markdown';
  }
  return 'file';
}

export function attachmentLabel(kind: FileKind): string {
  if (kind === 'image') {
    return 'Sent an image';
  }
  if (kind === 'pdf') {
    return 'Sent a PDF';
  }
  if (kind === 'spreadsheet') {
    return 'Sent a spreadsheet';
  }
  if (kind === 'audio') {
    return 'Sent a voice message';
  }
  if (kind === 'markdown') {
    return 'Sent a Markdown file';
  }
  return 'Sent a file';
}

export function messageSnippet(
  content: string,
  attachments: StoredFile[] = [],
  meeting?: { title: string } | null,
): string {
  const text = content.trim();
  if (text) {
    return text.slice(0, 140);
  }
  if (meeting?.title) {
    return meeting.title;
  }
  const first = attachments[0];
  if (!first) {
    return '';
  }
  const label = attachmentLabel(first.kind);
  if (attachments.length === 1) {
    return label;
  }
  return `${label} +${attachments.length - 1}`;
}

export function extractHttpUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const unique: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.;]+$/, '');
    if (!unique.includes(cleaned)) {
      unique.push(cleaned);
    }
  }
  return unique.slice(0, 3);
}
