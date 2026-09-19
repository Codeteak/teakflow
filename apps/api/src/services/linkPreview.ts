import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LinkPreview } from '@teakflow/shared';
import { extractHttpUrls } from '@teakflow/shared';

const cache = new Map<string, { at: number; value: LinkPreview | null }>();
const TTL_MS = 60 * 60 * 1000;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const property = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const contentFirst = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      'i',
    );
    const match = html.match(property) ?? html.match(contentFirst);
    if (match?.[1]) {
      return decodeEntities(match[1]);
    }
  }
  return '';
}

function isPrivateIp(ip: string) {
  if (ip === '::1' || ip === '0.0.0.0') {
    return true;
  }
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.')
  ) {
    return true;
  }
  const parts = ip.split('.').map(Number);
  if (
    parts.length === 4 &&
    parts[0] === 172 &&
    (parts[1] ?? 0) >= 16 &&
    (parts[1] ?? 0) <= 31
  ) {
    return true;
  }
  return (
    ip.toLowerCase().startsWith('fc') ||
    ip.toLowerCase().startsWith('fd') ||
    ip.toLowerCase().startsWith('fe80')
  );
}

async function assertPublicHttpUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links can be previewed.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '0.0.0.0') {
    throw new Error('That link cannot be previewed.');
  }
  const ip = isIP(hostname) ? hostname : (await lookup(hostname)).address;
  if (isPrivateIp(ip)) {
    throw new Error('That link cannot be previewed.');
  }
  return parsed;
}

function resolveUrl(base: URL, value: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const cached = cache.get(rawUrl);
  if (cached && Date.now() - cached.at < (cached.value ? TTL_MS : 30_000)) {
    return cached.value;
  }

  let parsed: URL;
  try {
    parsed = await assertPublicHttpUrl(rawUrl);
  } catch {
    cache.set(rawUrl, { at: Date.now(), value: null });
    return null;
  }

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) {
      cache.set(rawUrl, { at: Date.now(), value: null });
      return null;
    }
    const html = (await response.text()).slice(0, 200_000);
    if (!html.includes('<')) {
      cache.set(rawUrl, { at: Date.now(), value: null });
      return null;
    }
    const title =
      metaContent(html, ['og:title', 'twitter:title']) ||
      decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '');
    const description = metaContent(html, [
      'og:description',
      'twitter:description',
      'description',
    ]);
    const imageRaw = metaContent(html, [
      'og:image',
      'twitter:image',
      'twitter:image:src',
    ]);
    const siteName =
      metaContent(html, ['og:site_name']) || parsed.hostname.replace(/^www\./, '');
    const preview: LinkPreview = {
      url: parsed.toString(),
      title: title || parsed.hostname,
      description: description.slice(0, 280),
      image: imageRaw ? resolveUrl(parsed, imageRaw) : null,
      siteName,
    };
    cache.set(rawUrl, { at: Date.now(), value: preview });
    return preview;
  } catch {
    cache.set(rawUrl, { at: Date.now(), value: null });
    return null;
  }
}

export async function previewsForText(
  text: string,
  skipUrls: string[] = [],
): Promise<LinkPreview[]> {
  const skip = new Set(skipUrls);
  const urls = extractHttpUrls(text).filter(
    (url) => !skip.has(url) && !url.includes('res.cloudinary.com'),
  );
  const rows = await Promise.all(urls.map((url) => fetchLinkPreview(url)));
  return rows.filter((row): row is LinkPreview => Boolean(row));
}
