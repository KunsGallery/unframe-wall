const FALLBACK_PALETTE = ['#1648ff', '#38bda7', '#ff8e3c'];

const clamp = (value, min = 0, max = 255) => Math.min(max, Math.max(min, value));
const toHex = (value) => clamp(Math.round(value)).toString(16).padStart(2, '0');
const rgbToHex = ([r, g, b]) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
};

const mix = (first, second, amount) => {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * amount));
};

const luminance = ([r, g, b]) => {
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const saturation = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const distance = (a, b) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));

const readableAccent = (hex) => {
  const rgb = hexToRgb(hex);
  const current = luminance(rgb);
  if (current > 0.38) return mix(hex, '#071225', 0.35);
  if (current < 0.055) return mix(hex, '#ffffff', 0.2);
  return hex;
};

export const DEFAULT_THEME = {
  palette: FALLBACK_PALETTE,
  accent: FALLBACK_PALETTE[0],
  secondary: FALLBACK_PALETTE[1],
  tertiary: FALLBACK_PALETTE[2],
  background: '#f5f2ec',
  ink: '#101522',
};

export function buildSessionTheme(palette = FALLBACK_PALETTE) {
  const normalized = [...palette, ...FALLBACK_PALETTE].slice(0, 3);
  const accent = readableAccent(normalized[0]);
  const backgroundSource = normalized.reduce((best, color) => (
    saturation(hexToRgb(color)) < saturation(hexToRgb(best)) ? color : best
  ), normalized[0]);
  return {
    palette: normalized,
    accent,
    secondary: normalized[1],
    tertiary: normalized[2],
    background: mix(backgroundSource, '#ffffff', 0.91),
    ink: '#101522',
  };
}

export function themeStyle(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
  return {
    '--blue': merged.accent,
    '--session-accent-2': merged.secondary,
    '--session-accent-3': merged.tertiary,
    '--cream': merged.background,
    '--session-ink': merged.ink,
  };
}

export async function extractPalette(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG, WEBP 포스터만 사용할 수 있습니다.');
  }
  if (file.size >= 12 * 1024 * 1024) throw new Error('포스터는 12MB 미만으로 등록해 주세요.');

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += 16) {
    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    if (pixels[index + 3] < 210) continue;
    const light = luminance(rgb);
    const sat = saturation(rgb);
    if (light > 0.91 || light < 0.018 || (sat < 0.045 && light > 0.72)) continue;
    const quantized = rgb.map((value) => Math.round(value / 32) * 32).map((value) => clamp(value));
    const key = quantized.join(',');
    const current = buckets.get(key) || { rgb: [0, 0, 0], count: 0, score: 0 };
    current.rgb = current.rgb.map((value, channel) => value + rgb[channel]);
    current.count += 1;
    current.score += 1 + sat * 1.8;
    buckets.set(key, current);
  }

  const candidates = [...buckets.values()]
    .map((entry) => ({ rgb: entry.rgb.map((value) => value / entry.count), score: entry.score }))
    .sort((a, b) => b.score - a.score);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.every((color) => distance(color.rgb, candidate.rgb) >= 72)) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return [...selected.map((color) => rgbToHex(color.rgb)), ...FALLBACK_PALETTE].slice(0, 3);
}
