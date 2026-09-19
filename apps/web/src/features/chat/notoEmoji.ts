export type NotoAnimatedIcon = {
  name: string;
  codepoint: string;
  categories: string[];
  tags: string[];
  popularity: number;
};

const CATALOG_URL = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json';
const ASSET = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

let catalogPromise: Promise<NotoAnimatedIcon[]> | null = null;

export function emojiToNotoCodepoint(emoji: string) {
  return [...emoji]
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((part): part is string => Boolean(part) && part !== 'fe0f')
    .join('_');
}

export function notoCodepointToEmoji(codepoint: string) {
  return codepoint
    .split('_')
    .map((part) => String.fromCodePoint(Number.parseInt(part, 16)))
    .join('');
}

export function notoAnimatedUrl(codepoint: string, size: 32 | 128 | 512 = 128) {
  return `${ASSET}/${codepoint}/${size}.webp`;
}

export function loadNotoAnimatedCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load animated emoji.');
        }
        const body = (await response.json()) as { icons?: NotoAnimatedIcon[] };
        return [...(body.icons ?? [])].sort((a, b) => b.popularity - a.popularity);
      })
      .catch(() => []);
  }
  return catalogPromise;
}
