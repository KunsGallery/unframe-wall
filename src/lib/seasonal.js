import { DEFAULT_THEME, buildSessionTheme } from './colorPalette';

export const SEASONAL_PRESETS = {
  default: {
    label: '기본',
    description: '포스터 컬러 또는 UNFRAME 기본 블루',
    swatches: DEFAULT_THEME.palette,
  },
  christmas: {
    label: '크리스마스',
    description: '레드 · 그린 · 골드, 눈 내리는 월',
    swatches: ['#b3122b', '#1f6f4a', '#d4a843'],
    theme: {
      palette: ['#b3122b', '#1f6f4a', '#d4a843'],
      accent: '#b3122b',
      secondary: '#1f6f4a',
      tertiary: '#d4a843',
      background: '#f7f1e8',
      ink: '#1c1412',
    },
    copy: {
      display: {
        question: '올해, 당신을 따뜻하게 한 장면은 무엇인가요?',
        subtitle: 'Season’s greetings from UNFRAME',
      },
      input: {
        question: '올해의 따뜻한 장면을 들려주세요.',
        subtitle: '남겨주신 한 문장이 연말의 월을 밝힙니다.',
        placeholder: '올해 가장 기억에 남는 순간을 적어주세요.',
        buttonText: '마음 보내기',
        eventGuide: '나만의 Holiday Aura Ticket을 저장하고 공유해 보세요.',
      },
    },
  },
};

export const getPreset = (theme) => (theme?.preset === 'christmas' ? 'christmas' : 'default');

// 프리셋 색으로 덮을 때 포스터 컬러를 basePalette에 보관해 두었다가 '기본'으로 돌아올 때 복원
export function applyPreset(currentTheme = {}, presetKey, { snow = true } = {}) {
  const { preset: _preset, snow: _snow, basePalette, ...rest } = currentTheme;
  const posterFields = { posterUrl: rest.posterUrl, storagePath: rest.storagePath };
  if (presetKey === 'christmas') {
    return {
      ...posterFields,
      ...SEASONAL_PRESETS.christmas.theme,
      basePalette: basePalette || rest.palette || DEFAULT_THEME.palette,
      preset: 'christmas',
      snow,
    };
  }
  const restored = basePalette ? buildSessionTheme(basePalette) : _preset === 'christmas' ? DEFAULT_THEME : rest;
  return { ...posterFields, ...restored, preset: 'default', snow: false };
}

// Firestore는 undefined 필드를 거부하므로 비어 있는 값은 제거
export const cleanTheme = (theme) => Object.fromEntries(Object.entries(theme).filter(([, value]) => value !== undefined));
