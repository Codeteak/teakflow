import type { SessionUser } from '@teakflow/shared';

const INK = '#1B1A17';
const MUTED = '#6F6B64';
const SAGE = '#FC4903';
const WHITE = '#FFFFFF';

const WIDTH = 640;
const HEIGHT = 960;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function roleLabel(role: SessionUser['role']) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'LEAD') return 'Lead';
  return 'Employee';
}

function firstNameOf(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] ?? name;
}

function verticalTag(user: SessionUser) {
  const raw = (user.department || user.designation || 'Codeteak').replace(/\s+/g, '');
  return `#${raw}`;
}

function clipCard(ctx: CanvasRenderingContext2D) {
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.clip();
}

async function paintFront(user: SessionUser): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const rightStrip = 78;
  const orangeRight = WIDTH - rightStrip;
  const waveTop = HEIGHT * 0.52;
  const waveBottom = HEIGHT * 0.72;

  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  clipCard(ctx);

  // Orange field (left / top) — photo sits here
  ctx.fillStyle = SAGE;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(orangeRight, 0);
  ctx.lineTo(orangeRight, waveTop + 40);
  ctx.bezierCurveTo(
    orangeRight * 0.72,
    waveTop + 110,
    orangeRight * 0.28,
    waveBottom + 20,
    0,
    waveBottom,
  );
  ctx.closePath();
  ctx.fill();

  // Portrait — large, clipped to the orange wave
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(orangeRight, 0);
  ctx.lineTo(orangeRight, waveTop + 40);
  ctx.bezierCurveTo(
    orangeRight * 0.72,
    waveTop + 110,
    orangeRight * 0.28,
    waveBottom + 20,
    0,
    waveBottom,
  );
  ctx.closePath();
  ctx.clip();

  const avatar = user.avatar ? await loadImage(user.avatar) : null;
  const photoW = orangeRight + 40;
  const photoH = waveBottom + 40;
  const photoX = -20;
  const photoY = 20;

  if (avatar) {
    const targetRatio = photoW / photoH;
    const srcRatio = avatar.width / avatar.height;
    let sx = 0;
    let sy = 0;
    let sw = avatar.width;
    let sh = avatar.height;
    if (srcRatio > targetRatio) {
      sw = avatar.height * targetRatio;
      sx = (avatar.width - sw) / 2;
    } else {
      sh = avatar.width / targetRatio;
      sy = Math.max(0, (avatar.height - sh) * 0.15);
    }
    ctx.drawImage(avatar, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = WHITE;
    ctx.font = '700 120px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(user.name) || '?', orangeRight / 2, photoH * 0.42);
  }
  ctx.restore();

  // Soft fade where photo meets the wave
  const fade = ctx.createLinearGradient(0, waveTop, 0, waveBottom);
  fade.addColorStop(0, 'rgba(252,73,3,0)');
  fade.addColorStop(1, 'rgba(252,73,3,0.35)');
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.moveTo(0, waveTop);
  ctx.lineTo(orangeRight, waveTop);
  ctx.lineTo(orangeRight, waveTop + 40);
  ctx.bezierCurveTo(
    orangeRight * 0.72,
    waveTop + 110,
    orangeRight * 0.28,
    waveBottom + 20,
    0,
    waveBottom,
  );
  ctx.closePath();
  ctx.fill();

  // Vertical tag on the right white strip (bottom → top)
  const tag = verticalTag(user);
  ctx.save();
  ctx.fillStyle = SAGE;
  ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(WIDTH - rightStrip / 2, HEIGHT * 0.28);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(tag, 0, 0);
  ctx.restore();

  // Bottom-left logo mark (icon only — no orange box)
  const logo = await loadImage('/brand/codeteak-logo.svg');
  const markX = 40;
  const markY = HEIGHT - 132;
  const markSize = 64;
  if (logo) {
    ctx.drawImage(logo, markX, markY, markSize, markSize);
  } else {
    ctx.fillStyle = INK;
    ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CT', markX, markY + markSize / 2);
  }

  // Bottom-right identity stack
  const first = firstNameOf(user.name);
  const textRight = WIDTH - 40;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = '700 52px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(first, textRight, HEIGHT - 118);

  ctx.fillStyle = INK;
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  wrapText(ctx, user.name, textRight, HEIGHT - 82, WIDTH - 160, 24, 'right');

  ctx.fillStyle = MUTED;
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText(
    user.companyId ? `Codeteak ID: ${user.companyId}` : 'Codeteak ID',
    textRight,
    HEIGHT - 44,
  );

  ctx.restore();
  return canvas.toDataURL('image/png');
}

async function paintBack(user: SessionUser): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  clipCard(ctx);

  // Orange header band with wave into white
  ctx.fillStyle = SAGE;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(WIDTH, 0);
  ctx.lineTo(WIDTH, 210);
  ctx.bezierCurveTo(WIDTH * 0.7, 250, WIDTH * 0.3, 180, 0, 230);
  ctx.closePath();
  ctx.fill();

  const logo = await loadImage('/brand/codeteak-logo.svg');
  if (logo) {
    ctx.drawImage(logo, 48, 56, 56, 56);
  }

  ctx.fillStyle = WHITE;
  ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Codeteak Technologies', 120, 92);

  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(user.companyId ? `ID ${user.companyId}` : 'Company badge', 120, 122);

  const rows: Array<[string, string]> = [
    ...(user.companyId
      ? ([['Company ID', user.companyId]] as Array<[string, string]>)
      : []),
    ['Name', user.name],
    ['Email', user.email],
    ['Role', roleLabel(user.role)],
    ['Title', user.designation || '—'],
    ['Team', user.department || '—'],
  ];

  let y = 300;
  for (const [label, value] of rows) {
    ctx.fillStyle = MUTED;
    ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 48, y);
    ctx.fillStyle = INK;
    ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
    wrapText(ctx, value, 48, y + 32, WIDTH - 96, 28, 'left');
    y += 88;
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'center',
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 2);
  ctx.textAlign = align;
  shown.forEach((row, index) => {
    ctx.fillText(row, x, y + index * lineHeight);
  });
}

export async function buildIdCardFaces(user: SessionUser) {
  const [frontImage, backImage] = await Promise.all([paintFront(user), paintBack(user)]);
  return { frontImage, backImage };
}
