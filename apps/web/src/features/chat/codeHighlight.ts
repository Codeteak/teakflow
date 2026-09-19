import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import dart from 'highlight.js/lib/languages/dart';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import markdown from 'highlight.js/lib/languages/markdown';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('flutter', dart);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('zsh', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('kt', kotlin);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('env', ini);
hljs.registerLanguage('dotenv', ini);

const AUTO_LANGS = [
  'javascript',
  'typescript',
  'json',
  'python',
  'dart',
  'html',
  'css',
  'bash',
  'sql',
  'yaml',
  'java',
  'kotlin',
  'go',
  'rust',
  'csharp',
  'php',
  'ruby',
  'markdown',
  'ini',
] as const;

const LABEL: Record<string, string> = {
  javascript: 'JavaScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  json: 'JSON',
  python: 'Python',
  py: 'Python',
  dart: 'Dart',
  flutter: 'Flutter',
  html: 'HTML',
  xml: 'XML',
  css: 'CSS',
  bash: 'Shell',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  java: 'Java',
  kotlin: 'Kotlin',
  kt: 'Kotlin',
  go: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  csharp: 'C#',
  cs: 'C#',
  php: 'PHP',
  ruby: 'Ruby',
  rb: 'Ruby',
  markdown: 'Markdown',
  md: 'Markdown',
  env: '.env',
  dotenv: '.env',
  ini: '.env',
};

const ICONS: Record<string, string> = {
  javascript: '/language-icons/JavaScript-logo.png',
  js: '/language-icons/JavaScript-logo.png',
  jsx: '/language-icons/JavaScript-logo.png',
  typescript: '/language-icons/Typescript_logo_2020.svg',
  ts: '/language-icons/Typescript_logo_2020.svg',
  tsx: '/language-icons/Typescript_logo_2020.svg',
  json: '/language-icons/JSON_vector_logo.svg',
  python: '/language-icons/Python-logo-notext.svg',
  py: '/language-icons/Python-logo-notext.svg',
  dart: '/language-icons/Dart-logo-icon.svg',
  flutter: '/language-icons/Flutter_logo.svg',
  html: '/language-icons/HTML5_logo_and_wordmark.svg',
  xml: '/language-icons/HTML5_logo_and_wordmark.svg',
  css: '/language-icons/Official_CSS_Logo.svg',
  sql: '/language-icons/Sql_data_base_with_logo.png',
  markdown: '/language-icons/Markdown-mark.svg',
  md: '/language-icons/Markdown-mark.svg',
  env: '/language-icons/env-logo.svg',
  dotenv: '/language-icons/env-logo.svg',
  ini: '/language-icons/env-logo.svg',
};

function isFlutterCode(code: string) {
  return /\b(StatelessWidget|StatefulWidget|BuildContext|MaterialApp|CupertinoApp|Flutter|Widget\b)/.test(
    code,
  ) || /\b(?:import|export)\s+['"]package:flutter\//.test(code);
}

export function isEnvCode(code: string) {
  const lines = code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return false;

  const assignment =
    /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:".*"|'.*'|[^#\s].*)?$/;
  const commentOrBlank = /^#/;
  let assignments = 0;
  for (const line of lines) {
    if (commentOrBlank.test(line)) continue;
    if (!assignment.test(line)) return false;
    assignments += 1;
  }
  return assignments >= 2;
}

export function normalizeCodeLanguage(raw: string) {
  const key = raw.trim().toLowerCase().replace(/^\./, '');
  if (!key) return '';
  if (key === 'flutter') return 'dart';
  if (key === 'node') return 'javascript';
  if (key === 'nodejs') return 'javascript';
  if (key === 'py3' || key === 'python3') return 'python';
  if (key === 'env' || key === 'dotenv' || key === 'environment') return 'env';
  return key;
}

/** Language id used for labels/icons (keeps Flutter distinct from Dart). */
export function displayCodeLanguage(language: string, code = '') {
  const raw = language.trim().toLowerCase().replace(/^\./, '');
  if (raw === 'flutter' || (normalizeCodeLanguage(language) === 'dart' && isFlutterCode(code))) {
    return 'flutter';
  }
  if (raw === 'env' || raw === 'dotenv' || raw === 'environment') {
    return 'env';
  }
  if ((!raw || raw === 'ini') && code && isEnvCode(code)) {
    return 'env';
  }
  return normalizeCodeLanguage(language) || language.trim().toLowerCase();
}

export function codeLanguageLabel(language: string, code = '') {
  const key = displayCodeLanguage(language, code);
  if (!key) return 'Code';
  return LABEL[key] ?? (language || 'Code');
}

export function codeLanguageIcon(language: string, code = '') {
  const key = displayCodeLanguage(language, code);
  if (!key) return null;
  return ICONS[key] ?? null;
}

function tryParseJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Guess language from fence hint + content. */
export function detectCodeLanguage(code: string, hinted = ''): string {
  const hint = normalizeCodeLanguage(hinted);
  if (hint && hljs.getLanguage(hint)) {
    return hint === 'flutter' ? 'dart' : hint;
  }

  const trimmed = code.trim();
  if (!trimmed) return '';

  if (hint === 'env' || hint === 'dotenv' || hint === 'ini') {
    return 'env';
  }

  if (isEnvCode(trimmed)) {
    return 'env';
  }

  if (
    (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
    tryParseJson(trimmed)
  ) {
    return 'json';
  }

  if (
    /\b(StatelessWidget|StatefulWidget|BuildContext|MaterialApp|CupertinoApp|Flutter|Widget\b)/.test(
      trimmed,
    ) ||
    /\b(?:import|export)\s+['"]package:flutter\//.test(trimmed)
  ) {
    return 'dart';
  }

  if (
    /\bdef\s+\w+\s*\(|\bprint\s*\(|^\s*from\s+\w+\s+import\b|^\s*import\s+\w+(\s+as\s+\w+)?\s*$/m.test(
      trimmed,
    ) &&
    !/\b(const|let|var|function|=>)\b/.test(trimmed)
  ) {
    return 'python';
  }

  if (
    /\b(interface |type |enum )\w+|:\s*(string|number|boolean|void|React\.)|as const\b/.test(trimmed)
  ) {
    return 'typescript';
  }

  if (
    /\b(function|const|let|var|=>|import |export |require\(|module\.exports)\b/.test(trimmed) ||
    /\b(console\.(log|error|warn)|document\.|window\.)\b/.test(trimmed)
  ) {
    return 'javascript';
  }

  if (/<\/?[a-zA-Z][\w:-]*[\s>]/.test(trimmed) && /<[^>]+>/.test(trimmed)) {
    return 'html';
  }

  if (
    !/\b(function|const|let|var|=>|class |def )\b/.test(trimmed) &&
    trimmed.split(/\r?\n/).filter((line) => /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\[.+\]\(.+\))/.test(line.trim())).length >= 2
  ) {
    return 'markdown';
  }

  try {
    const auto = hljs.highlightAuto(trimmed, [...AUTO_LANGS]);
    if (auto.language && (auto.relevance ?? 0) >= 5) {
      return auto.language;
    }
  } catch {
    // ignore
  }

  return hint;
}

export function highlightCode(code: string, language = '') {
  const detected = detectCodeLanguage(code, language);
  const normalized = code.replace(/\r\n/g, '\n');

  if (detected && hljs.getLanguage(detected)) {
    try {
      const result = hljs.highlight(normalized, { language: detected, ignoreIllegals: true });
      return { language: detected, html: result.value };
    } catch {
      // fall through
    }
  }

  try {
    const auto = hljs.highlightAuto(normalized, [...AUTO_LANGS]);
    return {
      language: auto.language ?? detected,
      html: auto.value,
    };
  } catch {
    return {
      language: detected,
      html: escapeHtml(normalized),
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fenceLanguageForPaste(code: string) {
  const lang = detectCodeLanguage(code);
  if (lang === 'dart' && /\bFlutter|MaterialApp|StatelessWidget/.test(code)) {
    return 'flutter';
  }
  if (lang === 'env') return 'env';
  if (lang === 'markdown') return 'md';
  return lang;
}
